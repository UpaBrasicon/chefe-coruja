-- Percurso da UBS, U15, PR 1 (diagnóstico docs/ubs/U15-DIAGNOSTICO.md; RT,
-- 18/11/2026: V1 a V5 = A): o RAC da UBS na RNDS.
--
-- 1. Modalidade e caráter (V4). Na UBS o RAC sai com a modalidade 01 (Atenção
--    Básica, CodeSystem BRModalidadeAssistencial) e não 06 (urgência e
--    emergência); a consulta programada e a agendada (tipos 1 e 2 da ficha do
--    e-SUS APS) saem com o caráter 01 (eletivo), o resto com 02. Na UPA e no
--    hospital nada muda. O enfermeiro já assina o RAC da consulta de enfermagem:
--    é ele quem inicia o atendimento (atendimento_medico_id, U6) e o CBO vem do
--    perfil, com o bloqueio do CBO não autorizado que já existe (5C-5.4a).
-- 2. Por onde vai a RNDS da APS (V5). rnds_config_unidade.rac_aps_pelo:
--    'app' (padrão) ou 'pec' (o PEC e-SUS APS do município manda). Com 'pec', o
--    RAC dos atendimentos da UBS não entra na fila, e o que estava na fila
--    (pendente ou retido) é descartado. Troca o gestor da UBS
--    (rnds_rac_aps_pelo), com segundo fator e auditoria; o painel da RNDS mostra
--    a escolha.
-- 3. A ficha que venceu na UBS (U1, ninguém atendeu) não vira RAC.
--
-- O envio continua desligado em todas as unidades (decisão de 11/11/2026).
--
-- Idempotente. Teste: supabase/tests/ubs_u15_rac_aps.sql
--
-- Rollback (na ordem):
--   na public.rnds_painel(uuid), tirar "'rac_aps_pelo', g.rac_aps_pelo" do 'config';
--   DROP FUNCTION IF EXISTS public.rnds_rac_aps_pelo(uuid, text);
--   recriar private.enfileirar_documento(uuid, text, uuid, jsonb) de
--     20270205000001_rnds_envio_banco.sql (sem o "IF p_tipo = 'rac' AND private.rnds_rac_fora(...)");
--   DROP FUNCTION IF EXISTS private.rnds_rac_fora(uuid);
--   na private.rnds_carga_rac(uuid), voltar o 'contato' a
--     jsonb_build_object('modalidade', '06', 'carater', '02', 'procedencia', '99', 'desfecho', v_desfecho);
--   ALTER TABLE public.rnds_config_unidade DROP COLUMN IF EXISTS rac_aps_pelo;
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u15a_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(replace(p_pares[k + 1], chr(13), '') IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. chave por unidade ────────────────────────────────────────────────────
ALTER TABLE public.rnds_config_unidade
  ADD COLUMN IF NOT EXISTS rac_aps_pelo text NOT NULL DEFAULT 'app';
DO $$ BEGIN
  ALTER TABLE public.rnds_config_unidade ADD CONSTRAINT rnds_config_rac_aps_pelo_check CHECK (rac_aps_pelo IN ('app', 'pec'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN public.rnds_config_unidade.rac_aps_pelo IS
  'U15 (V5): na UBS, quem manda o RAC do atendimento da APS à RNDS: o app ou o PEC e-SUS APS do município.';

-- ── 2. o RAC que fica fora da fila ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.rnds_rac_fora(p_episodio uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.episodios e JOIN public.unidades u ON u.id = e.unidade_id AND u.tipo::text = 'ubs'
     WHERE e.id = p_episodio
       AND (coalesce((e.desfecho_detalhes ->> 'vencida')::boolean, false)
            OR EXISTS (SELECT 1 FROM public.rnds_config_unidade c WHERE c.unidade_id = e.unidade_id AND c.rac_aps_pelo = 'pec')))
$$;
REVOKE ALL ON FUNCTION private.rnds_rac_fora(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.enfileirar_documento(
  p_unidade_id   uuid,
  p_tipo         text,
  p_referencia_id uuid,
  p_payload      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text := 'pendente';
  v_erro   text := NULL;
BEGIN
  -- idempotência: já há item vivo para esta referência e este tipo
  IF EXISTS (SELECT 1 FROM public.interop_outbox o
             WHERE o.tipo_documento = p_tipo AND o.referencia_id = p_referencia_id
               AND o.status IN ('pendente', 'retido', 'enviado')) THEN
    RETURN;
  END IF;

  -- U15 (V5): na UBS que manda a RNDS pelo PEC, ou na ficha que venceu, não há RAC do app
  IF p_tipo = 'rac' AND p_referencia_id IS NOT NULL AND private.rnds_rac_fora(p_referencia_id) THEN
    RETURN;
  END IF;

  IF p_payload IS NULL OR p_tipo IS NULL OR p_referencia_id IS NULL OR p_unidade_id IS NULL THEN
    v_status := 'erro';
    v_erro := 'payload/tipo/referencia/unidade ausentes';
  END IF;

  BEGIN
    IF v_status = 'pendente' AND NOT (
      p_tipo IN ('rac','sumario_alta')
      AND jsonb_typeof(p_payload) = 'object'
      AND p_payload->>'resourceType' = 'Bundle'
    ) THEN
      v_status := 'erro';
      v_erro := 'payload não é um Bundle FHIR válido';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_status := 'erro';
    v_erro := SQLERRM;
  END;

  INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status, ultimo_erro)
  VALUES (p_unidade_id, p_tipo, p_referencia_id, p_payload, v_status, v_erro);
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status, ultimo_erro)
    VALUES (p_unidade_id, p_tipo, p_referencia_id, COALESCE(p_payload, '{}'::jsonb), 'erro', SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

-- ── 3. modalidade e caráter do RAC da UBS ───────────────────────────────────
SELECT pg_temp.u15a_trocar('private.rnds_carga_rac(uuid)'::regprocedure,
  $a$    'contato', jsonb_build_object('modalidade', '06', 'carater', '02', 'procedencia', '99', 'desfecho', v_desfecho),$a$,
  $b$    -- U15 (V4): na UBS, Atenção Básica (01); consulta programada ou agendada é eletiva (01)
    'contato', jsonb_build_object(
      'modalidade', CASE WHEN EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = e.unidade_id AND u.tipo::text = 'ubs') THEN '01' ELSE '06' END,
      'carater', CASE WHEN EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = e.unidade_id AND u.tipo::text = 'ubs')
                       AND e.tipo_atendimento_aps IN ('consulta_programada', 'consulta_agendada') THEN '01' ELSE '02' END,
      'procedencia', '99', 'desfecho', v_desfecho),$b$);

-- ── 4. o gestor da UBS escolhe por onde vai a RNDS da APS ───────────────────
CREATE OR REPLACE FUNCTION public.rnds_rac_aps_pelo(p_unidade uuid, p_pelo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_descartados integer := 0;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade configura a RNDS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = p_unidade AND u.tipo::text = 'ubs') THEN
    RAISE EXCEPTION 'A escolha vale só para a UBS.';
  END IF;
  IF p_pelo IS NULL OR p_pelo NOT IN ('app', 'pec') THEN RAISE EXCEPTION 'Escolha: app ou pec.'; END IF;
  INSERT INTO public.rnds_config_unidade (unidade_id, rac_aps_pelo, atualizado_por)
  VALUES (p_unidade, p_pelo, private.meu_perfil_id())
  ON CONFLICT (unidade_id) DO UPDATE
    SET rac_aps_pelo = excluded.rac_aps_pelo, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  IF p_pelo = 'pec' THEN
    UPDATE public.interop_outbox
       SET status = 'descartado', ultimo_erro = 'a RNDS da APS desta UBS vai pelo PEC e-SUS APS', atualizado_em = now()
     WHERE unidade_id = p_unidade AND tipo_documento = 'rac' AND status IN ('pendente', 'retido');
    GET DIAGNOSTICS v_descartados = ROW_COUNT;
  END IF;
  PERFORM private.registrar_auditoria('rnds_rac_aps_pelo', 'rnds_config_unidade', p_unidade, p_unidade,
    jsonb_build_object('tipo', p_pelo, 'quantidade', v_descartados));
  RETURN v_descartados;
END;
$$;
REVOKE ALL ON FUNCTION public.rnds_rac_aps_pelo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rnds_rac_aps_pelo(uuid, text) TO authenticated;

-- ── 5. o painel da RNDS mostra a escolha ────────────────────────────────────
SELECT pg_temp.u15a_trocar('public.rnds_painel(uuid)'::regprocedure,
  $a$      'pausado_em', g.pausado_em, 'pausa_motivo', g.pausa_motivo, 'atualizado_em', g.atualizado_em) END,$a$,
  $b$      'pausado_em', g.pausado_em, 'pausa_motivo', g.pausa_motivo, 'atualizado_em', g.atualizado_em,
      'rac_aps_pelo', g.rac_aps_pelo) END,$b$);
