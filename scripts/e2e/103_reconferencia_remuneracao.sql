-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do achado C P2-C1 (C05.01) depois da
-- 20270308000004_remuneracao_autor_auditoria.sql (A em M1 e M2, por
-- delegação do RT em 08/11/2026).
--
-- O gestor da UPA F5 cadastra um valor de remuneração como a tela faz
-- (insert com criado_por nulo) e depois o desativa: o autor é o login e as
-- duas ações vão à auditoria. Valor fictício de teste; a linha fica
-- desativada (não entra em prévia nem no ERP).
-- Cada passo roda como a conta do papel (e2e.bpasso, do 60).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DELETE FROM e2e.vars WHERE nome LIKE 'rem\_%';
SELECT e2e.b_guardar('rem_inicio', now()::text);

SELECT e2e.bpasso(NULL, 'REM.01.incluir', 'f5_ges_upa', '/unidade?aba=configuracoes (Remuneração de plantão)', 'Gestor inclui um valor como a tela (criado_por nulo)',
  $q$INSERT INTO public.remuneracoes_plantao (unidade_id, turno, valor, criado_por)
     VALUES ('f5100000-0000-4000-8000-000000000002', 'noite', 1.23, NULL) RETURNING id::text$q$, 'ok', 'rem_id');
SELECT e2e.bpasso('rem_id', 'REM.02.autor', 'banco', NULL, 'O autor gravado é o login do gestor',
  format($q$SELECT e2e.b_confere(r.criado_por = e2e.conta('f5_ges_upa'), 'criado_por ' || coalesce(right(r.criado_por::text, 4), 'nulo'))
    FROM public.remuneracoes_plantao r WHERE r.id = %L$q$, e2e.u('rem_id')));
SELECT e2e.bpasso('rem_id', 'REM.03.desativar', 'f5_ges_upa', '/unidade?aba=configuracoes (Remuneração de plantão)', 'Gestor remove o valor (desativa)',
  format($q$UPDATE public.remuneracoes_plantao SET ativo = false WHERE id = %L RETURNING id::text$q$, e2e.u('rem_id')));
SELECT e2e.bpasso('rem_id', 'REM.04.auditoria', 'banco', NULL, 'Inclusão e desativação na auditoria, com o autor = login',
  format($q$SELECT e2e.b_confere(count(*) FILTER (WHERE acao = 'remuneracao_incluida') = 1 AND count(*) FILTER (WHERE acao = 'remuneracao_desativada') = 1
      AND bool_and(ator_id = e2e.conta('f5_ges_upa')), string_agg(acao, ', ' ORDER BY created_at))
    FROM public.log_auditoria WHERE entidade = 'remuneracoes_plantao' AND entidade_id = %L$q$, e2e.u('rem_id')));

SELECT passo, situacao, left(coalesce(detalhe, ''), 140) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'REM.%' AND em >= e2e.v('rem_inicio')::timestamptz ORDER BY id;
