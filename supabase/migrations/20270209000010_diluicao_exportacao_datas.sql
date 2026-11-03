-- ════════════════════════════════════════════════════════════════════════════
-- VD14 do lote "Virada de data" (BACKLOG.md, RT em 01/11/2026, P2): diluição e
-- exportação pelo dia UTC.
--
-- O banco roda em UTC; das 21h às 24h de Brasília o dia UTC já é amanhã.
-- 1. publicar_diluicao_versao: data_revisao = current_date. A tabela publicada
--    das 21h às 24h ficava revisada amanhã (em 31/12, no ano seguinte).
-- 2. publicar_diluicao (a publicação antiga, da curadoria): p_data_revisao
--    tinha DEFAULT CURRENT_DATE. Passa a DEFAULT NULL, e sem a data vale o dia
--    de Brasília. O default não usa private.data_atual() direto porque é
--    avaliado com o papel de quem chama, que não enxerga o esquema private.
-- 3. private.exp_linhas: o período da exportação ia de desde::timestamptz a
--    (ate + 1)::timestamptz, meia-noite UTC (21h de Brasília). Passa a ir da
--    meia-noite de Brasília do primeiro dia à meia-noite seguinte ao último.
--
-- Como em 20270209000003, cada troca é feita na definição atual da função,
-- lida sem o CR do fim de linha. Mesma assinatura, dono e grants.
-- Idempotente: trecho já trocado não muda; função mudada para com erro.
-- Teste: supabase/tests/vd14_diluicao_exportacao.sql
--
-- Rollback: as mesmas trocas invertidas (ver o doc
-- docs/virada-de-data/CORRECAO-VD14-DILUICAO-EXPORTACAO.md).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.vd14_trocar(p_f regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
BEGIN
  IF position(p_novo IN def) > 0 AND position(p_antigo IN def) = 0 THEN RETURN; END IF;
  IF position(p_antigo IN def) = 0 THEN
    RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_antigo;
  END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;

-- 1. revisão da diluição publicada
SELECT pg_temp.vd14_trocar('public.publicar_diluicao_versao(uuid)',
  'data_revisao = current_date', 'data_revisao = private.data_atual()');

-- 2. publicação antiga sem a data
SELECT pg_temp.vd14_trocar('public.publicar_diluicao(uuid, text, date)',
  'p_data_revisao date DEFAULT CURRENT_DATE', 'p_data_revisao date DEFAULT NULL::date');
SELECT pg_temp.vd14_trocar('public.publicar_diluicao(uuid, text, date)',
  'data_revisao = p_data_revisao', 'data_revisao = coalesce(p_data_revisao, private.data_atual())');

-- 3. período da exportação em dias de Brasília
SELECT pg_temp.vd14_trocar('private.exp_linhas(public.exportacoes, integer, integer)',
  'v_ini timestamptz := x.desde::timestamptz;',
  'v_ini timestamptz := (x.desde::timestamp AT TIME ZONE ''America/Sao_Paulo'');');
SELECT pg_temp.vd14_trocar('private.exp_linhas(public.exportacoes, integer, integer)',
  'v_fim timestamptz := (x.ate + 1)::timestamptz;',
  'v_fim timestamptz := ((x.ate + 1)::timestamp AT TIME ZONE ''America/Sao_Paulo'');');

DROP FUNCTION pg_temp.vd14_trocar(regprocedure, text, text);
