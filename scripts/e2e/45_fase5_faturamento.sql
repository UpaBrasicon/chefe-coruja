-- ════════════════════════════════════════════════════════════════════════════
-- Portão da Fase 5 — etapa B, faturamento (5B), na rede F5. Usa as contas que a
-- etapa A gerou na UPA (atendimento do José, evasão do Pedro, internação do
-- Carlos). Passos 'F5.B.*', como o papel, pelas RPCs das telas.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.passo('F5.B.1.contas', 2, 'f5_fat', '/faturamento', 'Faturamento lista as contas da UPA e acha a do José',
  format($q$SELECT (c ->> 'id') FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
    WHERE c -> 'paciente' ->> 'nome' = 'José F5 Dor Torácica' AND c -> 'atendimento' ->> 'desfecho' = 'alta' LIMIT 1$q$,
    'f5100000-0000-4000-8000-000000000002'), 'ok', 'f5conta2');
SELECT e2e.passo('F5.B.1.internacao', 9, 'f5_fat', '/faturamento', 'A internação do Carlos tem conta própria',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
    WHERE c -> 'paciente' ->> 'nome' = 'Carlos F5 Pneumonia' AND c ->> 'tipo' <> 'ambulatorial'), 'conta da internação')$q$,
    'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.passo('F5.B.1.ubs_sem_bpa', NULL, 'f5_ges_ubs', '/faturamento', 'A conta da UBS abre sem linha de BPA (decisão D6 da tarefa 2)',
  format($q$SELECT e2e.confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
    WHERE jsonb_array_length(public.conta_detalhe((c ->> 'id')::uuid) -> 'itens') > 0), 'UBS sem linha de BPA')$q$,
    'f5100000-0000-4000-8000-000000000001'));
SELECT e2e.passo('F5.B.1.recepcao_sem_contas', NULL, 'f5_rec_upa', '/faturamento', 'Recepção não lê as contas (deve ser recusado)',
  format('SELECT public.contas_da_unidade(%L::uuid, NULL, NULL)::text', 'f5100000-0000-4000-8000-000000000002'), 'erro:Acesso negado');
SELECT e2e.passo('F5.B.2.detalhe', 2, 'f5_fat', '/faturamento (conta)', 'Detalhe da conta mostra a pré-auditoria (pendências bloqueantes)',
  format($q$SELECT e2e.confere((SELECT count(*) > 0 FROM jsonb_array_elements(public.conta_detalhe(%L::uuid) -> 'pendencias') p WHERE (p ->> 'bloqueante')::boolean),
    'pendências bloqueantes')$q$, e2e.u('f5conta2')));
SELECT e2e.passo('F5.B.3.conferencia', 2, 'f5_fat', '/faturamento (conta)', 'Faturamento leva a conta à conferência',
  format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('f5conta2'), 'em_conferencia'));
SELECT e2e.passo('F5.B.3.fechar_travado', 2, 'f5_fat', '/faturamento (conta)', 'Fechar com pendência bloqueante é travado (pré-auditoria)',
  format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('f5conta2'), 'fechada'), 'erro:A conta tem');
SELECT e2e.passo('F5.B.3.fat_nao_libera', 2, 'f5_fat', '/faturamento (conta)', 'Faturamento não libera o fechamento (é do gestor; deve ser recusado)',
  format($q$SELECT public.liberar_fechamento_conta(%L::uuid, 'Cadastro do teste incompleto, liberado para seguir')::text$q$, e2e.u('f5conta2')), 'erro');
SELECT e2e.passo('F5.B.3.gestor_libera', 2, 'f5_ges_upa', '/faturamento (conta)', 'Gestora libera o fechamento com motivo',
  format($q$SELECT public.liberar_fechamento_conta(%L::uuid, 'Cadastro do teste incompleto, liberado para seguir')::text$q$, e2e.u('f5conta2')));
SELECT e2e.passo('F5.B.3.fechar', 2, 'f5_fat', '/faturamento (conta)', 'Faturamento fecha a conta liberada',
  format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('f5conta2'), 'fechada'));
SELECT e2e.passo('F5.B.3.faturada', 2, 'f5_fat', '/faturamento (conta)', 'Faturamento marca como faturada',
  format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('f5conta2'), 'faturada'));
SELECT e2e.passo('F5.B.3.fat_nao_reabre', 2, 'f5_fat', '/faturamento (conta)', 'Faturamento não reabre conta faturada (é do gestor; deve ser recusado)',
  format($q$SELECT public.mudar_etapa_conta(%L::uuid, 'aberta', 'Teste de permissão do faturamento')::text$q$, e2e.u('f5conta2')), 'erro:Reabrir conta fechada é do gestor');
SELECT e2e.passo('F5.B.4.glosas', NULL, 'f5_fat', '/faturamento (glosas)', 'Lista de glosas da unidade abre',
  format('SELECT public.glosas_da_unidade(%L::uuid, NULL, NULL)::text', 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.passo('F5.B.5.erp', NULL, 'f5_fat', '/faturamento (ERP)', 'A exportação do ERP lê as contas da unidade',
  format('SELECT left(public.erp_contas_da_unidade(%L::uuid)::text, 200)', 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.passo('F5.B.6.outra_rede', NULL, 'faturamento', '/faturamento', 'Faturamento de outra rede não lê as contas da UPA F5 (deve ser recusado)',
  format('SELECT public.contas_da_unidade(%L::uuid, NULL, NULL)::text', 'f5100000-0000-4000-8000-000000000002'), 'erro:Acesso negado');

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'F5.B.%' AND em > now() - interval '1 hour' GROUP BY 1 ORDER BY 1;
