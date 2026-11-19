-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U15, vacina, PR 6 (plano docs/ubs/U15-VACINA-PLANO.md; RT,
-- 19/11/2026: VC1 a VC7 = A): a Ficha de Vacinação do SISAB na fila do LEDI.
--
-- LEDI APS 8.7.0, Ficha de Vacinação (tipo 14; IDL oficial ficha_vacinacao.thrift,
-- laboratoriobridge/esusaps-integracao, commit 9316f280f526). Uma ficha por
-- vacina registrada (aplicada ou transcrita), com o profissional que registrou.
--
-- 1. ledi_fila aceita o tipo 'fv' (expand: os tipos antigos continuam).
-- 2. Gatilho em vacinacoes: a vacina registrada entra na fila; cancelada antes do
--    envio, a ficha é descartada. Cancelada depois de enviada, nada muda aqui:
--    a ficha de cancelamento (uuidFichaCancelada) fica em aberto
--    (docs/ubs/U15-LEDI-FICHAS.md).
-- 3. private.ledi_carga_fv(vacina): unidade, profissional, cidadão e a vacina.
--    Retém (prefixo "retido:") o profissional com CBO fora da Tabela 12 do LEDI
--    (terminologia.vacina_cbo, migration 20270415000025), além do que a carga do
--    cidadão e da unidade já retêm.
-- 4. ledi_dados_ficha monta a carga da 'fv'; a conferência noturna também
--    enfileira as vacinas do dia.
--
-- Idempotente. Teste: supabase/tests/ubs_u15_ficha_vacinacao.sql
--
-- Rollback (na ordem): as trocas invertidas (os trechos estão abaixo);
--   DROP TRIGGER IF EXISTS trg_ledi_fv ON public.vacinacoes;
--   DROP FUNCTION IF EXISTS private.trg_ledi_fv(), private.ledi_carga_fv(uuid);
--   DELETE FROM public.ledi_fila WHERE tipo = 'fv';
--   ALTER TABLE public.ledi_fila DROP CONSTRAINT ledi_fila_tipo_check,
--     ADD CONSTRAINT ledi_fila_tipo_check CHECK (tipo IN ('fai', 'fp'));
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u15f_trocar(p_f regprocedure, VARIADIC p_pares text[])
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

-- ── 1. o tipo novo na fila ──────────────────────────────────────────────────
ALTER TABLE public.ledi_fila DROP CONSTRAINT IF EXISTS ledi_fila_tipo_check;
ALTER TABLE public.ledi_fila ADD CONSTRAINT ledi_fila_tipo_check CHECK (tipo IN ('fai', 'fp', 'fv'));
COMMENT ON TABLE public.ledi_fila IS
  'U15: fichas do LEDI APS (fai = atendimento individual, fp = procedimentos, fv = vacinação) a enviar ao PEC e-SUS APS do município.';

-- ── 2. a vacina entra na fila ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.trg_ledi_fv()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = NEW.unidade_id AND u.tipo::text = 'ubs') THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' AND NEW.cancelado_em IS NULL THEN
    PERFORM private.ledi_enfileirar(NEW.unidade_id, 'fv', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.cancelado_em IS NOT NULL AND OLD.cancelado_em IS NULL THEN
    UPDATE public.ledi_fila SET status = 'descartado', ultimo_erro = 'vacina cancelada', atualizado_em = now()
     WHERE tipo = 'fv' AND referencia_id = NEW.id AND status IN ('pendente', 'retido', 'erro');
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.trg_ledi_fv() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_ledi_fv ON public.vacinacoes;
CREATE TRIGGER trg_ledi_fv AFTER INSERT OR UPDATE OF cancelado_em ON public.vacinacoes
  FOR EACH ROW EXECUTE FUNCTION private.trg_ledi_fv();

-- ── 3. a carga da ficha ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ledi_carga_fv(p_vacinacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v public.vacinacoes; v_prof jsonb;
BEGIN
  SELECT * INTO v FROM public.vacinacoes WHERE id = p_vacinacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'vacina % não encontrada', p_vacinacao; END IF;
  IF v.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'retido: vacina cancelada'; END IF;
  v_prof := private.ledi_carga_profissional(v.registrado_por);
  IF NOT EXISTS (SELECT 1 FROM terminologia.vacina_cbo c WHERE c.cbo = v_prof ->> 'cbo') THEN
    RAISE EXCEPTION 'retido: CBO do profissional fora da Tabela 12 do LEDI (quem pode registrar vacina)';
  END IF;
  RETURN jsonb_build_object(
    'unidade', private.ledi_carga_unidade(v.unidade_id),
    'profissional', v_prof,
    'cidadao', private.ledi_carga_cidadao(v.paciente_id),
    'vacina', jsonb_build_object(
      'id', v.id, 'registro_anterior', v.registro_anterior, 'data_aplicacao', v.data_aplicacao,
      'registrado_em', v.registrado_em, 'imunobiologico', v.imunobiologico, 'estrategia', v.estrategia, 'dose', v.dose,
      'lote', v.lote, 'fabricante', v.fabricante, 'grupo_atendimento', v.grupo_atendimento,
      'via', v.via, 'local', v.local, 'aplicado_exterior', v.aplicado_exterior,
      'condicao_maternal', v.condicao_maternal, 'viajante', v.viajante, 'comunicante_hanseniase', v.comunicante_hanseniase,
      'prescritor_cbo', v.prescritor_cbo, 'cid10_motivo', v.cid10_motivo, 'pesquisa_clinica', v.pesquisa_clinica));
END;
$$;
REVOKE ALL ON FUNCTION private.ledi_carga_fv(uuid) FROM PUBLIC, anon, authenticated;

-- ── 4. o serviço de envio e a conferência noturna ───────────────────────────
SELECT pg_temp.u15f_trocar('public.ledi_dados_ficha(uuid)'::regprocedure,
  $a$  v_carga := CASE f.tipo WHEN 'fai' THEN private.ledi_carga_fai(f.referencia_id) ELSE private.ledi_carga_fp(f.referencia_id) END;$a$,
  $b$  v_carga := CASE f.tipo WHEN 'fai' THEN private.ledi_carga_fai(f.referencia_id)
                            WHEN 'fv' THEN private.ledi_carga_fv(f.referencia_id)  -- U15, vacina
                            ELSE private.ledi_carga_fp(f.referencia_id) END;$b$);

SELECT pg_temp.u15f_trocar('private.ledi_conferencia_noturna(date)'::regprocedure,
  $a$  v_antes integer; v_fai integer; v_fp integer; r record;$a$,
  $b$  v_antes integer; v_fai integer; v_fp integer; v_fv integer; r record;$b$,
  $a$  RETURN jsonb_build_object('dia', v_dia, 'fai', v_fai, 'fp', v_fp);$a$,
  $b$  -- U15, vacina: as vacinas registradas no dia
  SELECT count(*) INTO v_antes FROM public.ledi_fila WHERE tipo = 'fv';
  FOR r IN
    SELECT v.id, v.unidade_id FROM public.vacinacoes v JOIN public.unidades u ON u.id = v.unidade_id AND u.tipo::text = 'ubs'
     WHERE v.cancelado_em IS NULL AND v.registrado_em >= v_ini AND v.registrado_em < v_fim
  LOOP
    PERFORM private.ledi_enfileirar(r.unidade_id, 'fv', r.id);
  END LOOP;
  SELECT count(*) - v_antes INTO v_fv FROM public.ledi_fila WHERE tipo = 'fv';
  RETURN jsonb_build_object('dia', v_dia, 'fai', v_fai, 'fp', v_fp, 'fv', v_fv);$b$);
