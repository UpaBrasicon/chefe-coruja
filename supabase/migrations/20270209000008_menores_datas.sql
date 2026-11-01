-- ════════════════════════════════════════════════════════════════════════════
-- VD11 do lote "Virada de data" (BACKLOG.md, RT em 01/11/2026, P3): menores.
--
-- Datas pelo dia UTC (o banco roda em UTC; das 21h às 24h de Brasília o dia
-- UTC já é amanhã) e o fim do dia do censo:
-- 1. implantacao_treinar: aceitava treinamento com a data de amanhã e, sem
--    data, gravava amanhã (current_date).
-- 2. aplicar_primeiro_acesso: idade mínima de 16 anos e máxima de 100 com
--    current_date (aceitava um dia antes).
-- 3. conteudo_pacote_alta: idade na alta com data_alta::date (dia UTC).
-- 4. resumo_busca_ia: baldes diários dos logs da busca pelo dia UTC e janela
--    de 24 h corridas; passa a ser por dia de Brasília, hoje e os p_dias - 1
--    anteriores.
-- 5. censo_recente e gerar_censo_todas_unidades: janela e dia padrão com
--    current_date.
-- 6. gerar_censo_diario: o dia acabava em 23:59:59-03 (com <=), e o que
--    acontecia no último segundo (23:59:59,000001 em diante) não entrava em
--    nenhum dia. Passa a ser até a meia-noite seguinte, exclusiva.
--
-- Como em 20270209000003, cada troca é feita na definição atual da função,
-- lida sem o CR do fim de linha. Mesma assinatura, dono e grants.
-- Idempotente: trecho já trocado não muda; função mudada para com erro.
-- Teste: supabase/tests/vd11_menores.sql e fase3_implantacao.sql
--
-- Rollback: as mesmas trocas invertidas.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.vd11_trocar(p_f regprocedure, p_antigo text, p_novo text)
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

-- 1 e 2. dia de Brasília
SELECT pg_temp.vd11_trocar('public.implantacao_treinar(uuid, uuid, text, date, text)', 'current_date', 'private.data_atual()');
SELECT pg_temp.vd11_trocar('private.aplicar_primeiro_acesso(uuid, text, jsonb)', 'current_date', 'private.data_atual()');

-- 3. idade na alta
SELECT pg_temp.vd11_trocar('private.conteudo_pacote_alta(uuid)',
  'coalesce(i.data_alta, now())::date',
  '(coalesce(i.data_alta, now()) AT TIME ZONE ''America/Sao_Paulo'')::date');

-- 4. baldes e janela da busca
SELECT pg_temp.vd11_trocar('public.resumo_busca_ia(uuid, integer)',
  'SELECT l.created_at::date AS dia,',
  'SELECT (l.created_at AT TIME ZONE ''America/Sao_Paulo'')::date AS dia,');
SELECT pg_temp.vd11_trocar('public.resumo_busca_ia(uuid, integer)',
  'AND l.created_at >= now() - make_interval(days => greatest(p_dias, 1))',
  'AND l.created_at >= ((private.data_atual() - greatest(p_dias, 1) + 1)::text || '' 00:00:00-03'')::timestamptz');

-- 5. janela e dia padrão do censo
SELECT pg_temp.vd11_trocar('public.censo_recente(uuid, integer)', 'current_date', 'private.data_atual()');
SELECT pg_temp.vd11_trocar('public.gerar_censo_todas_unidades(date)', 'current_date', 'private.data_atual()');

-- 6. fim do dia do censo: meia-noite seguinte, exclusiva
SELECT pg_temp.vd11_trocar('private.gerar_censo_diario(uuid, date)',
  'v_dia_fim timestamptz := (p_data::text || '' 23:59:59-03'')::timestamptz;',
  'v_dia_fim timestamptz := ((p_data + 1)::text || '' 00:00:00-03'')::timestamptz;');
SELECT pg_temp.vd11_trocar('private.gerar_censo_diario(uuid, date)', '<= v_dia_fim', '< v_dia_fim');

DROP FUNCTION pg_temp.vd11_trocar(regprocedure, text, text);
