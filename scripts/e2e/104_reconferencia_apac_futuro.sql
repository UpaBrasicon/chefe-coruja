-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do achado C P2-C2 (C03.08) depois da
-- 20270308000005_apac_sem_futuro.sql (A em F1 e F2, por delegação do RT em
-- 08/11/2026).
--
-- O faturamento F5 repete o passo C03.08 do 72_cenario_c03.sql: a execução da
-- APAC do C03 na competência seguinte, com data de ocorrência no mês seguinte.
-- Antes era aceita; agora é recusada. Usa as variáveis c03_* do 72.
-- Cada passo roda como a conta do papel (e2e.bpasso, do 60).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.b_guardar('apf_inicio', now()::text);
SELECT e2e.bpasso(NULL, 'APF.01.competencia_futura', 'f5_fat', '/apac (Registrar execução)',
  'Execução na competência seguinte, com data de ocorrência no mês seguinte (deve ser recusada)',
  format('SELECT public.registrar_execucao_apac(%L::uuid, %L, %L, %L, %L::date, %L::uuid, %L::jsonb)::text', e2e.u('c03_apac'),
    to_char(private.data_atual() + interval '1 month', 'YYYYMM'), '01', '21', (private.data_atual() + interval '1 month')::date, e2e.u('c03_med'),
    jsonb_build_array(jsonb_build_object('procedimento', e2e.v('c03_proc'), 'quantidade', 1))), 'erro:Competência no futuro');
SELECT e2e.bpasso(NULL, 'APF.02.data_futura', 'f5_fat', '/apac (Registrar execução)',
  'Execução na competência atual com data de ocorrência amanhã (deve ser recusada)',
  format('SELECT public.registrar_execucao_apac(%L::uuid, %L, %L, %L, %L::date, %L::uuid, %L::jsonb)::text', e2e.u('c03_apac'),
    to_char(private.data_atual(), 'YYYYMM'), '01', '21', private.data_atual() + 1, e2e.u('c03_med'),
    jsonb_build_array(jsonb_build_object('procedimento', e2e.v('c03_proc'), 'quantidade', 1))), 'erro:Data de ocorrência no futuro');

SELECT passo, situacao, left(coalesce(detalhe, ''), 140) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'APF.%' AND em >= e2e.v('apf_inicio')::timestamptz ORDER BY id;
