-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U15, vacina, PR 7 (plano docs/ubs/U15-VACINA-PLANO.md; RT,
-- 19/11/2026: VC6 = A): a vacina vai à RNDS no Registro de Imunobiológico
-- Administrado em Rotina (RIA-R).
--
-- Fonte: Manual de Integração RIA-R v1.9 (DATASUS) e as definições do validador
-- oficial (CodeSystems BRImunobiologico, BRDose, BREstrategiaVacinacao,
-- BRGrupoAtendimento, BRViaAdministracao, BRLocalAplicacao, BRCondicaoMaternal,
-- BRRegistroOrigem, BRPais e BRFabricantePNI), em
-- produto/docs/pesquisa/rnds-oficial/ria/. Os códigos do LEDI guardados na
-- migration 20270415000025 batem com os da RNDS: imunobiológico e dose pelo
-- mesmo código; estratégia, grupo, via e local pela coluna codigo_rnds.
--
-- 1. interop_outbox aceita o tipo 'ria' (expand).
-- 2. Gatilho em vacinacoes: a vacina registrada entra na fila da RNDS, menos
--    na UBS que manda a RNDS pelo PEC do município (rnds_config_unidade.rac_aps_pelo
--    = 'pec', a mesma escolha do RAC, U15 V5). Cancelada antes do envio, o item é
--    descartado. Cancelada depois de enviada, a exclusão na RNDS fica em aberto.
-- 3. private.rnds_carga_ria(vacina): paciente, estabelecimento, profissional e a
--    vacina já nos códigos da RNDS. Na transcrição de caderneta, o que o LEDI
--    não guarda vai com o código "sem registro" da RNDS (grupo 00, estratégia 0).
-- 4. rnds_dados_documento monta a carga do 'ria'.
--
-- Idempotente. Teste: supabase/tests/ubs_u15_ria_rnds.sql
--
-- Rollback (na ordem): a troca invertida em rnds_dados_documento;
--   DROP TRIGGER IF EXISTS trg_rnds_ria ON public.vacinacoes;
--   DROP FUNCTION IF EXISTS private.trg_rnds_ria(), private.rnds_carga_ria(uuid);
--   DELETE FROM public.interop_outbox WHERE tipo_documento = 'ria';
--   ALTER TABLE public.interop_outbox DROP CONSTRAINT interop_outbox_tipo_documento_check,
--     ADD CONSTRAINT interop_outbox_tipo_documento_check CHECK (tipo_documento IN ('rac', 'sumario_alta', 'regulacao'));
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u15g_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
  de text; para text;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    de := replace(p_pares[k], chr(13), '');
    para := replace(p_pares[k + 1], chr(13), '');
    CONTINUE WHEN position(para IN novo) > 0;
    IF position(de IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, de;
    END IF;
    novo := replace(novo, de, para);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. o tipo novo na fila da RNDS ──────────────────────────────────────────
ALTER TABLE public.interop_outbox DROP CONSTRAINT IF EXISTS interop_outbox_tipo_documento_check;
ALTER TABLE public.interop_outbox ADD CONSTRAINT interop_outbox_tipo_documento_check
  CHECK (tipo_documento IN ('rac', 'sumario_alta', 'regulacao', 'ria'));

-- ── 2. a vacina entra na fila ───────────────────────────────────────────────
-- nunca trava o registro da vacina: o erro só deixa de enfileirar
CREATE OR REPLACE FUNCTION private.trg_rnds_ria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.cancelado_em IS NULL THEN
    -- VC6 = A: a UBS que manda a RNDS pelo PEC não manda o RIA pelo app
    IF EXISTS (SELECT 1 FROM public.rnds_config_unidade c WHERE c.unidade_id = NEW.unidade_id AND c.rac_aps_pelo = 'pec') THEN
      RETURN NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.interop_outbox o WHERE o.tipo_documento = 'ria' AND o.referencia_id = NEW.id
                      AND o.status IN ('pendente', 'retido', 'enviado')) THEN
      INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status, profissional_id)
      VALUES (NEW.unidade_id, 'ria', NEW.id, '{}'::jsonb, 'pendente', NEW.registrado_por);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.cancelado_em IS NOT NULL AND OLD.cancelado_em IS NULL THEN
    UPDATE public.interop_outbox SET status = 'descartado', ultimo_erro = 'vacina cancelada', atualizado_em = now()
     WHERE tipo_documento = 'ria' AND referencia_id = NEW.id AND status IN ('pendente', 'retido', 'erro');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_rnds_ria (%): %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.trg_rnds_ria() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_rnds_ria ON public.vacinacoes;
CREATE TRIGGER trg_rnds_ria AFTER INSERT OR UPDATE OF cancelado_em ON public.vacinacoes
  FOR EACH ROW EXECUTE FUNCTION private.trg_rnds_ria();

-- ── 3. a carga do RIA ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.rnds_carga_ria(p_vacinacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v public.vacinacoes; v_sexo text;
BEGIN
  SELECT * INTO v FROM public.vacinacoes WHERE id = p_vacinacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'vacina % não encontrada', p_vacinacao; END IF;
  IF v.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'retido: vacina cancelada'; END IF;
  SELECT pa.sexo INTO v_sexo FROM public.pacientes pa WHERE pa.id = v.paciente_id;
  RETURN jsonb_build_object(
    'paciente', private.rnds_carga_paciente(v.paciente_id),
    'estabelecimento', private.rnds_carga_estabelecimento(v.unidade_id),
    'profissional', private.rnds_carga_profissional(v.registrado_por),
    'vacina', jsonb_build_object(
      'id', v.id,
      'registro_anterior', v.registro_anterior,
      'aplicado_exterior', coalesce(v.aplicado_exterior, false),
      'data_aplicacao', v.data_aplicacao,
      'registrado_em', v.registrado_em,
      'imunobiologico', v.imunobiologico::text,
      'dose', v.dose::text,
      'estrategia', coalesce((SELECT e.codigo_rnds::text FROM terminologia.vacina_estrategia e WHERE e.codigo = v.estrategia), '0'),
      'grupo_atendimento', coalesce((SELECT g.codigo_rnds FROM terminologia.vacina_grupo_atendimento g WHERE g.codigo = v.grupo_atendimento), '00'),
      'via', (SELECT x.codigo_rnds FROM terminologia.vacina_via x WHERE x.codigo = v.via),
      'local', (SELECT x.codigo_rnds FROM terminologia.vacina_local x WHERE x.codigo = v.local),
      'fabricante', v.fabricante,
      'lote', v.lote,
      'validade', (SELECT l.validade FROM public.vacina_lotes l WHERE l.id = v.lote_id),
      -- BRCondicaoMaternal: 1 = não se aplica (o masculino vai com 1)
      'condicao_maternal', coalesce(v.condicao_maternal::text, CASE WHEN v_sexo = 'M' THEN '1' END),
      'comunicante_hanseniase', v.comunicante_hanseniase,
      'prescritor_cbo', v.prescritor_cbo,
      'cid10_motivo', v.cid10_motivo));
END;
$$;
REVOKE ALL ON FUNCTION private.rnds_carga_ria(uuid) FROM PUBLIC, anon, authenticated;

-- ── 4. o serviço de envio recebe a carga ────────────────────────────────────
SELECT pg_temp.u15g_trocar('public.rnds_dados_documento(uuid)'::regprocedure,
  $a$  ELSIF o.tipo_documento = 'sumario_alta' THEN$a$,
  $b$  ELSIF o.tipo_documento = 'ria' THEN  -- U15, vacina
    v_dados := private.rnds_carga_ria(o.referencia_id);
    v_prof := nullif(v_dados -> 'profissional' ->> 'id', '')::uuid;
  ELSIF o.tipo_documento = 'sumario_alta' THEN$b$);
