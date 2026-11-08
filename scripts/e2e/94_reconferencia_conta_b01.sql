-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do B01 depois da 20270307000001_conta_na_conversao.sql
-- (achado B P1-1, 07/11/2026). Repete, com o mesmo paciente do B01, o passo
-- B01.15.conta_internacao e a parte da internação do B01.29: a conta de
-- internação (aberta agora pela migration) aparece para o faturamento, passa
-- por conferência e fechamento, e congela a AIH.
--
-- Usa as variáveis do B01 em e2e.vars (b01_int, b01_conta_porta, b01_nome) e
-- as funções e2e.* criadas pelo 60_cenario_b01.sql. A conta da porta já foi
-- fechada no B01 e não é tocada aqui.
-- ════════════════════════════════════════════════════════════════════════════
SELECT e2e.b_guardar('b01_reconf_inicio', now()::text);
SELECT e2e.bpasso('b01_int', 'B01.15.conta_internacao', 'banco', NULL, 'Conta de internação aberta (gatilho trg_conta_da_internacao), com conta_origem_id = conta da porta',
  format($q$SELECT coalesce((SELECT c.numero || ', origem ' || coalesce(right(c.conta_origem_id::text, 4), '-') FROM public.contas c
      WHERE c.internacao_id = %L AND c.tipo = 'internacao' AND c.conta_origem_id = %L), e2e.b_falhar('nenhuma conta de internação para esta internação'))$q$,
    e2e.u('b01_int'), e2e.u('b01_conta_porta')));
SELECT e2e.bpasso('b01_int', 'B01.29.conta_int', 'f5_fat', '/faturamento/contas', 'Conta da internação',
  e2e.b_conta_sql('f5100000-0000-4000-8000-000000000002', e2e.v('b01_nome'), 'internacao'), 'ok', 'b01_conta_int');
SELECT e2e.bpasso(x.dep, 'B01.29.' || x.k || '_conferencia', 'f5_fat', '/faturamento/contas', 'Conta ' || x.k || ': aberta → em_conferencia',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 150)', e2e.u(x.dep), 'em_conferencia'))
  FROM (VALUES (2, 'b01_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.bpasso(x.dep, 'B01.29.' || x.k || '_custos', 'f5_fat', '/faturamento/contas', 'Custos e pré-auditoria da conta ' || x.k, e2e.b_conta_resumo_sql(e2e.u(x.dep)))
  FROM (VALUES (2, 'b01_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.bpasso(x.dep, 'B01.29.' || x.k || '_fechar', 'f5_fat', '/faturamento/contas', 'Conta ' || x.k || ': em_conferencia → fechada',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 150)', e2e.u(x.dep), 'fechada'), 'ok', x.dep || '_fechada')
  FROM (VALUES (2, 'b01_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
-- pendência bloqueante: o gestor libera e o faturamento fecha
SELECT CASE WHEN e2e.v(x.dep) IS NOT NULL AND e2e.v(x.dep || '_fechada') IS NULL THEN
  e2e.bpasso(x.dep, 'B01.29.' || x.k || '_liberar', 'f5_ges_upa', '/faturamento/contas', 'Gestor libera o fechamento com motivo',
    format($q$SELECT left(public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo B01: pendências conhecidas da rede de teste')::text, 200)$q$, e2e.u(x.dep))) END
  FROM (VALUES (2, 'b01_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT CASE WHEN e2e.v(x.dep) IS NOT NULL AND e2e.v(x.dep || '_fechada') IS NULL THEN
  e2e.bpasso(x.dep, 'B01.29.' || x.k || '_fechar_liberada', 'f5_fat', '/faturamento/contas', 'Fecha a conta liberada',
    format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 150)', e2e.u(x.dep), 'fechada'), 'ok', x.dep || '_fechada') END
  FROM (VALUES (2, 'b01_conta_int', 'internacao')) x(o, dep, k) ORDER BY x.o;
SELECT e2e.bpasso('b01_conta_int_fechada', 'B01.29.congelados', 'banco', NULL, 'Itens congelados: classificação, consulta e medicação na porta; AIH na internação',
  format($q$SELECT e2e.b_confere((SELECT itens_congelados::text FROM public.contas WHERE id = %1$L) LIKE '%%0303010037%%'
      AND (SELECT itens_congelados::text FROM public.contas WHERE id = %2$L) LIKE '%%0301060096%%',
      (SELECT string_agg(c.tipo || ' ' || c.status || ' ' || coalesce((SELECT string_agg((x ->> 'procedimento') || '=' || coalesce(x ->> 'valor_total', 'nulo'), ', ') FROM jsonb_array_elements(c.itens_congelados) x), '-'), ' | ')
         FROM public.contas c WHERE c.id IN (%1$L, %2$L)))$q$, e2e.u('b01_conta_int'), e2e.u('b01_conta_porta')));
SELECT passo, situacao, left(detalhe, 200) AS detalhe FROM e2e.resultados
 WHERE em >= e2e.v('b01_reconf_inicio')::timestamptz ORDER BY em;
