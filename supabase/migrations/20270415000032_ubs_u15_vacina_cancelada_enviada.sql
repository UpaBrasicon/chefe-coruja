-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U15, vacina: a vacina cancelada no app DEPOIS de enviada.
-- Pendência dos PRs 6 e 7 (docs/ubs/U15-LEDI-FICHAS.md, docs/rnds/ENVIO.md).
--
-- RNDS (Manual RIA-R v1.9, 3.3 e 8; nota técnica de exclusão e substituição):
-- a exclusão lógica é o FHIR Delete do Bundle enviado
-- (DELETE {ehr}/api/fhir/r4/Bundle/{id RNDS}, resposta 204), feita por quem
-- enviou (UF, CNES, sistema e autor). A RNDS só a admite para paciente errado
-- ou registro em duplicidade: a vacina cancelada com motivo é um registro que
-- não aconteceu como lançado.
--   1. O gatilho trg_rnds_ria, no cancelamento, põe na fila da RNDS um item 'ria'
--      de exclusão (payload {"acao": "excluir"}) quando o RIA já foi enviado. Quem
--      assina é quem cancelou.
--   2. rnds_dados_documento devolve {"acao": "excluir"} para esse item; o id RNDS
--      do RIA enviado já vem em envio.id_rnds_anterior. O serviço faz o DELETE.
--
-- SISAB (LEDI APS 8.7.0): o layout não documenta cancelamento de ficha pela API
-- (uuidFichaCancelada está no IDL, mas não no dicionário nem nas regras da
-- transmissão). A ficha já enviada fica marcada na aba SISAB, com o aviso para
-- excluí-la no PEC do município.
--   3. trg_ledi_fv, no cancelamento, grava o aviso na ficha enviada.
--
-- Idempotente. Teste: supabase/tests/ubs_u15_vacina_cancelada_enviada.sql
--
-- Rollback: as trocas invertidas (os trechos estão abaixo);
--   UPDATE public.interop_outbox SET status = 'descartado' WHERE tipo_documento = 'ria' AND payload ->> 'acao' = 'excluir' AND status <> 'enviado';
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u15h_trocar(p_f regprocedure, VARIADIC p_pares text[])
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

-- ── 1. RNDS: a exclusão entra na fila ───────────────────────────────────────
SELECT pg_temp.u15h_trocar('private.trg_rnds_ria()'::regprocedure,
  $a$     WHERE tipo_documento = 'ria' AND referencia_id = NEW.id AND status IN ('pendente', 'retido', 'erro');$a$,
  $b$     WHERE tipo_documento = 'ria' AND referencia_id = NEW.id AND status IN ('pendente', 'retido', 'erro');
    -- RIA já enviado: a exclusão lógica na RNDS (FHIR Delete), assinada por quem cancelou
    IF EXISTS (SELECT 1 FROM public.interop_outbox o WHERE o.tipo_documento = 'ria' AND o.referencia_id = NEW.id
                  AND o.status = 'enviado' AND o.id_rnds IS NOT NULL AND coalesce(o.payload ->> 'acao', '') <> 'excluir')
       AND NOT EXISTS (SELECT 1 FROM public.interop_outbox o WHERE o.tipo_documento = 'ria' AND o.referencia_id = NEW.id
                          AND o.payload ->> 'acao' = 'excluir' AND o.status IN ('pendente', 'retido', 'enviado')) THEN
      INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status, profissional_id)
      VALUES (NEW.unidade_id, 'ria', NEW.id, jsonb_build_object('acao', 'excluir'), 'pendente', NEW.cancelado_por);
    END IF;$b$);

-- ── 2. RNDS: a carga da exclusão ────────────────────────────────────────────
SELECT pg_temp.u15h_trocar('public.rnds_dados_documento(uuid)'::regprocedure,
  $a$  ELSIF o.tipo_documento = 'ria' THEN  -- U15, vacina
    v_dados := private.rnds_carga_ria(o.referencia_id);
    v_prof := nullif(v_dados -> 'profissional' ->> 'id', '')::uuid;$a$,
  $b$  ELSIF o.tipo_documento = 'ria' AND o.payload ->> 'acao' = 'excluir' THEN  -- U15, vacina cancelada depois de enviada
    v_dados := jsonb_build_object('acao', 'excluir');
    v_prof := o.profissional_id;
  ELSIF o.tipo_documento = 'ria' THEN  -- U15, vacina
    v_dados := private.rnds_carga_ria(o.referencia_id);
    v_prof := nullif(v_dados -> 'profissional' ->> 'id', '')::uuid;$b$,
  -- o id RNDS a excluir é o do RIA enviado, nunca o de outra exclusão
  $a$     AND x.status = 'enviado' AND x.id_rnds IS NOT NULL AND x.id <> o.id$a$,
  $b$     AND x.status = 'enviado' AND x.id_rnds IS NOT NULL AND x.id <> o.id
     AND coalesce(x.payload ->> 'acao', '') <> 'excluir'$b$);

-- ── 3. SISAB: o aviso na ficha enviada ──────────────────────────────────────
SELECT pg_temp.u15h_trocar('private.trg_ledi_fv()'::regprocedure,
  $a$     WHERE tipo = 'fv' AND referencia_id = NEW.id AND status IN ('pendente', 'retido', 'erro');$a$,
  $b$     WHERE tipo = 'fv' AND referencia_id = NEW.id AND status IN ('pendente', 'retido', 'erro');
    -- o LEDI 8.7.0 não tem cancelamento pela API: quem corrige é o PEC do município
    UPDATE public.ledi_fila SET ultimo_erro = 'vacina cancelada no app depois do envio: exclua a ficha no PEC do município',
           atualizado_em = now()
     WHERE tipo = 'fv' AND referencia_id = NEW.id AND status = 'enviado';$b$);
