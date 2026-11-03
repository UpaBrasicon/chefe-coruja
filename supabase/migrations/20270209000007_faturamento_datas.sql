-- ════════════════════════════════════════════════════════════════════════════
-- VD10 do lote "Virada de data" (BACKLOG.md, RT em 01/11/2026, P2): datas do
-- faturamento e das críticas.
--
-- 1. rede_faturamento: a APAC sem validade_inicio entrava na competência de
--    solicitada_em::date, o dia UTC. Pedida das 21h às 24h do último dia do
--    mês, caía na competência seguinte. Passa a ser o dia de Brasília.
-- 2. criticas_aih: idade do paciente com current_date (UTC). É avaliada na
--    emissão do laudo e na conferência; passa a ser o dia de Brasília.
-- 3. apac_arquivo: o responsável é o próprio paciente se maior de 18 anos, pela
--    idade de hoje (current_date). Passa a ser a idade no início da validade da
--    APAC (o procedimento), ou hoje em Brasília se ela não tiver início.
-- 4. criticas_lancamento_aih: idade com age(nascimento), a de hoje. Ganha a
--    versão com a data do procedimento, p_data; a conta (conta_itens) passa a
--    chamá-la com o dia de Brasília de realizado_em. A versão antiga, de 4
--    argumentos, fica (expand) com a idade de hoje em Brasília.
--
-- Como em 20270209000003, cada troca é feita na definição atual da função,
-- lida sem o CR do fim de linha; corpos conferidos (md5) iguais na homologação
-- e na produção em 01/11/2026. Mesma assinatura, dono e grants. Idempotente:
-- trecho já trocado não muda; função mudada (sem o trecho antigo nem o novo)
-- para com erro.
-- Teste: supabase/tests/vd10_faturamento_datas.sql
--
-- Rollback: as mesmas trocas invertidas, na ordem inversa (conta_itens antes),
-- e DROP FUNCTION private.criticas_lancamento_aih(text, integer, text, uuid, date).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.vd10_trocar(p_f regprocedure, p_antigo text, p_novo text)
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

-- 1. competência da APAC sem validade_inicio
SELECT pg_temp.vd10_trocar('public.rede_faturamento(uuid, text)',
  'coalesce(ap.validade_inicio, ap.solicitada_em::date)',
  'coalesce(ap.validade_inicio, (ap.solicitada_em AT TIME ZONE ''America/Sao_Paulo'')::date)');

-- 2. idade na crítica da AIH
SELECT pg_temp.vd10_trocar('private.criticas_aih(uuid, uuid, jsonb, uuid)',
  'age(current_date, pa.data_nascimento)',
  'age(private.data_atual(), pa.data_nascimento)');

-- 3. responsável no arquivo da APAC
SELECT pg_temp.vd10_trocar('private.apac_arquivo(uuid, text)',
  'age(current_date, pa.data_nascimento)',
  'age(coalesce(a.validade_inicio, private.data_atual()), pa.data_nascimento)');

-- 4. idade na crítica do procedimento lançado: versão com a data do procedimento
DO $$
DECLARE
  def text;
BEGIN
  IF to_regprocedure('private.criticas_lancamento_aih(text, integer, text, uuid, date)') IS NULL THEN
    def := replace(pg_get_functiondef('private.criticas_lancamento_aih(text, integer, text, uuid)'::regprocedure), chr(13), '');
    IF position('p_paciente uuid)' IN def) = 0 OR position('age(pa.data_nascimento)' IN def) = 0 THEN
      RAISE EXCEPTION 'criticas_lancamento_aih mudou: cabeçalho ou idade não encontrados';
    END IF;
    def := replace(def, 'p_paciente uuid)', 'p_paciente uuid, p_data date)');
    def := replace(def, 'age(pa.data_nascimento)', 'age(coalesce(p_data, private.data_atual()), pa.data_nascimento)');
    EXECUTE def;
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.criticas_lancamento_aih(text, integer, text, uuid, date) FROM PUBLIC, anon, authenticated;

SELECT pg_temp.vd10_trocar('private.criticas_lancamento_aih(text, integer, text, uuid)',
  'age(pa.data_nascimento)',
  'age(private.data_atual(), pa.data_nascimento)');

SELECT pg_temp.vd10_trocar('private.conta_itens(public.contas)',
  'private.criticas_lancamento_aih(l.procedimento, l.quantidade, l.cbo, c.paciente_id)',
  'private.criticas_lancamento_aih(l.procedimento, l.quantidade, l.cbo, c.paciente_id, (l.realizado_em AT TIME ZONE ''America/Sao_Paulo'')::date)');

DROP FUNCTION pg_temp.vd10_trocar(regprocedure, text, text);
