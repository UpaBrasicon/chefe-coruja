-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U6, PR 3b: prescrição do enfermeiro pelo protocolo do
-- município. Diagnóstico e decisões em docs/ubs/U6-PRESCRICAO-ENFERMEIRO.md
-- (#931; R1–R5 = A do RT em 18/11/2026). Base: Lei 7.498/1986, art. 11, II, c;
-- PNAB (Portaria de Consolidação nº 2/2017, Anexo XXII); Portaria SVS/MS
-- 344/1998 (controle especial só de prescritor habilitado).
--
-- 1. receita_protocolos ganha a marca "protocolo de enfermagem do município" e o
--    documento de origem (número, data e órgão). Protocolo de enfermagem
--    publicado sem o documento de origem é recusado (CHECK).
-- 2. definir_protocolo_enfermagem: o gestor marca o protocolo e informa a origem.
--    receita_protocolos_da_unidade devolve a marca e a origem.
-- 3. Receita só do médico (plantonista ou telemedicina) ou, na consulta de
--    enfermagem aberta do paciente, do enfermeiro com itens iguais aos de um
--    protocolo de enfermagem publicado, sem controle especial. Os outros papéis
--    não emitem receita. A regra entra em private.faltas_documento, que vale
--    para a emissão direta, o rascunho e a sincronização sem conexão.
--
-- Idempotente. Teste: supabase/tests/ubs_prescricao_enfermeiro.sql
--
-- Rollback (na ordem): trocas 2 e 3 invertidas (os trechos estão abaixo);
--   DROP FUNCTION public.definir_protocolo_enfermagem(uuid, boolean, text, date, text),
--     private.faltas_receita_papel(uuid, uuid, jsonb);
--   as colunas e o CHECK ficam (expand); para tirá-los, com janela:
--   ALTER TABLE public.receita_protocolos DROP CONSTRAINT receita_protocolos_enfermagem_origem,
--     DROP COLUMN enfermagem, DROP COLUMN origem_numero, DROP COLUMN origem_data, DROP COLUMN origem_orgao;
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u6r_trocar(p_f regprocedure, VARIADIC p_pares text[])
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

-- ── 1. marca e documento de origem ──────────────────────────────────────────
ALTER TABLE public.receita_protocolos
  ADD COLUMN IF NOT EXISTS enfermagem boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_numero text CHECK (origem_numero IS NULL OR length(origem_numero) <= 80),
  ADD COLUMN IF NOT EXISTS origem_data date,
  ADD COLUMN IF NOT EXISTS origem_orgao text CHECK (origem_orgao IS NULL OR length(origem_orgao) <= 160);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'receita_protocolos_enfermagem_origem'
                   AND conrelid = 'public.receita_protocolos'::regclass) THEN
    ALTER TABLE public.receita_protocolos ADD CONSTRAINT receita_protocolos_enfermagem_origem CHECK (
      NOT enfermagem OR NOT ativo OR (origem_numero IS NOT NULL AND origem_data IS NOT NULL AND origem_orgao IS NOT NULL));
  END IF;
END $$;
COMMENT ON COLUMN public.receita_protocolos.enfermagem IS
  'Protocolo de enfermagem do município (U6, 3b): o enfermeiro prescreve só os itens destes protocolos publicados.';

-- ── 2. o gestor marca o protocolo de enfermagem ─────────────────────────────
CREATE OR REPLACE FUNCTION public.definir_protocolo_enfermagem(p_protocolo uuid, p_enfermagem boolean,
  p_numero text DEFAULT NULL, p_data date DEFAULT NULL, p_orgao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.receita_protocolos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.receita_protocolos WHERE id = p_protocolo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo não encontrado.'; END IF;
  IF NOT private.sou_gestor_da_unidade(r.unidade_id) THEN RAISE EXCEPTION 'Só o gestor da unidade marca o protocolo de enfermagem.'; END IF;
  IF coalesce(p_enfermagem, false) THEN
    IF length(btrim(coalesce(p_numero, ''))) = 0 THEN RAISE EXCEPTION 'Informe o número do documento de origem do protocolo.'; END IF;
    IF p_data IS NULL OR p_data > private.data_atual() THEN RAISE EXCEPTION 'Informe a data do documento de origem (não pode ser futura).'; END IF;
    IF length(btrim(coalesce(p_orgao, ''))) < 3 THEN RAISE EXCEPTION 'Informe o órgão que publicou o protocolo (ex.: Secretaria Municipal de Saúde).'; END IF;
  END IF;
  UPDATE public.receita_protocolos
     SET enfermagem = coalesce(p_enfermagem, false),
         origem_numero = CASE WHEN p_enfermagem THEN btrim(p_numero) END,
         origem_data = CASE WHEN p_enfermagem THEN p_data END,
         origem_orgao = CASE WHEN p_enfermagem THEN btrim(p_orgao) END,
         atualizado_por = private.meu_perfil_id(), atualizado_em = now()
   WHERE id = p_protocolo;
  PERFORM private.registrar_auditoria('atualizar', 'receita_protocolos', p_protocolo, r.unidade_id,
    jsonb_build_object('enfermagem', coalesce(p_enfermagem, false)));
END $$;
REVOKE ALL ON FUNCTION public.definir_protocolo_enfermagem(uuid, boolean, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_protocolo_enfermagem(uuid, boolean, text, date, text) TO authenticated;

SELECT pg_temp.u6r_trocar('public.receita_protocolos_da_unidade(uuid)'::regprocedure,
  $a$'fonte', r.fonte, 'itens', r.itens, 'ativo', r.ativo,$a$,
  $b$'fonte', r.fonte, 'itens', r.itens, 'ativo', r.ativo, 'enfermagem', r.enfermagem, 'origem_numero', r.origem_numero, 'origem_data', r.origem_data, 'origem_orgao', r.origem_orgao,$b$);

-- ── 3. quem emite a receita ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.faltas_receita_papel(p_paciente uuid, p_autor uuid, b jsonb)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid;
  f text[] := '{}';
  it jsonb;
  v_med text;
BEGIN
  IF p_autor IS NULL THEN RETURN f; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  -- o médico (de plantão ou da telemedicina) segue como antes
  IF EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = p_autor AND v.unidade_id = v_unidade AND v.ativo
                AND v.papel::text IN ('plantonista', 'telemedicina')) THEN
    RETURN f;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = p_autor AND v.unidade_id = v_unidade AND v.ativo AND v.papel::text = 'enfermeiro')
     OR NOT EXISTS (SELECT 1 FROM public.episodios e WHERE e.paciente_id = p_paciente AND e.destino_aps = 'enfermagem' AND e.etapa <> 'encerrado') THEN
    RETURN ARRAY['A receita é do médico; o enfermeiro prescreve só na consulta de enfermagem, pelo protocolo do município'];
  END IF;
  -- o enfermeiro: só itens iguais aos de um protocolo de enfermagem publicado, sem controle especial
  IF (b -> 'controle_especial') = 'true'::jsonb THEN
    f := array_append(f, 'Receita de controle especial é só do médico (Portaria 344/1998)');
  END IF;
  FOR it IN SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(b -> 'itens') = 'array' THEN b -> 'itens' ELSE '[]'::jsonb END) x LOOP
    v_med := coalesce(nullif(btrim(CASE WHEN jsonb_typeof(it) = 'object' THEN it ->> 'medicamento' ELSE it #>> '{}' END), ''), 'medicamento');
    IF jsonb_typeof(it) = 'object' AND (it -> 'controle_especial') = 'true'::jsonb THEN
      f := array_append(f, (v_med || ': controle especial é só do médico (Portaria 344/1998)'));
    ELSIF jsonb_typeof(it) IS DISTINCT FROM 'object' OR NOT EXISTS (
      SELECT 1 FROM public.receita_protocolos rp, jsonb_array_elements(rp.itens) pi
       WHERE rp.unidade_id = v_unidade AND rp.ativo AND rp.enfermagem
         AND btrim(pi ->> 'medicamento') = btrim(coalesce(it ->> 'medicamento', ''))
         AND btrim(pi ->> 'posologia') = btrim(coalesce(it ->> 'posologia', ''))
         AND btrim(coalesce(pi ->> 'quantidade', '')) = btrim(coalesce(it ->> 'quantidade', ''))) THEN
      f := array_append(f, (v_med || ': fora do protocolo de enfermagem publicado (sai como está no protocolo)'));
    END IF;
  END LOOP;
  RETURN f;
END $$;
REVOKE ALL ON FUNCTION private.faltas_receita_papel(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

SELECT pg_temp.u6r_trocar('private.faltas_documento(text,text,uuid,uuid)'::regprocedure,
  $a$    b := CASE WHEN jsonb_typeof(j -> 'receita') = 'object' THEN j -> 'receita' ELSE '{}'::jsonb END;$a$,
  $b$    b := CASE WHEN jsonb_typeof(j -> 'receita') = 'object' THEN j -> 'receita' ELSE '{}'::jsonb END; f := f || private.faltas_receita_papel(p_paciente, p_autor, b);  -- U6, 3b$b$);
