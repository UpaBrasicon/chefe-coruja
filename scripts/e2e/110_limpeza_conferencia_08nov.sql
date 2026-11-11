-- Limpeza da homologação depois da conferência das telas (08/11/2026): encerra
-- as duas observações de teste da UPA F5, abertas por medico.upa.f5, e cancela
-- o pedido nº 197. Cada passo como a conta do papel.
SELECT e2e.b_guardar('lp8_inicio', now()::text);
SELECT e2e.b_guardar('lp8_gest', '0b0a5cd3-bc44-4998-94aa-e62f506bc93b');
SELECT e2e.b_guardar('lp8_gest_reg', (SELECT s.id::text FROM public.regulacao_solicitacoes s JOIN public.internacoes i ON i.paciente_id = s.paciente_id
   WHERE i.id = '0b0a5cd3-bc44-4998-94aa-e62f506bc93b' ORDER BY s.criada_em DESC LIMIT 1));
SELECT e2e.b_guardar('lp8_gest_pac', (SELECT paciente_id::text FROM public.internacoes WHERE id = '0b0a5cd3-bc44-4998-94aa-e62f506bc93b'));

SELECT e2e.bpasso('ob8_reg', 'LP8.01.cancelar_197', 'f5_med_upa', '/regulacao (origem)', 'Cancela o pedido nº 197, feito só para conferir a lista de leitos',
  format($q$SELECT left(public.regulacao_cancelar(%L::uuid, 'Pedido de teste da conferência das telas, cancelado na limpeza da homologação.')::text, 40)$q$, e2e.u('ob8_reg')));
SELECT e2e.bpasso('ob8_int', 'LP8.02.alta_obs', 'f5_med_upa', '/observacao (Observações que você abriu → Encerrar)', 'Quem abriu dá alta médica ao paciente de teste da observação (CID do próprio SOAP)',
  format($q$SELECT left(public.finalizar_observacao(%L::uuid, 'alta_medica', 'R10.4', NULL, '{}'::jsonb)::text, 60)$q$, e2e.u('ob8_int')));
-- lacuna 7 (10/11/2026): a transferência pede o documento de transferência emitido antes
SELECT e2e.bpasso('lp8_gest_pac', 'LP8.03.doc_transferencia', 'f5_med_upa', '/observacao (Observações que você abriu → Encerrar)', 'Quem abriu emite o documento de transferência (lacuna 7)',
  format($q$SELECT left(public.emitir_documento_transferencia(%L::uuid, jsonb_build_object('resumo_clinico', 'Resumo clínico de teste (limpeza 08/11, dado fictício).', 'condutas', 'Condutas de teste conforme o roteiro (limpeza 08/11, dado fictício).', 'motivo', 'Gestante já internada no Hospital F5 pela regulação (teste).'))::text, 120)$q$, e2e.u('lp8_gest_pac')));
SELECT e2e.bpasso('lp8_gest', 'LP8.03.gestante_transf', 'f5_med_upa', '/observacao (Observações que você abriu → Encerrar)', 'Quem abriu encerra a observação da Gestante A01 por transferência (ela já está internada no Hospital F5)',
  format($q$SELECT left(public.finalizar_observacao(%L::uuid, 'transferencia', 'O14.1', NULL, jsonb_build_object('destino', 'Hospital Fase 5', 'regulacao_id', %L))::text, 60)$q$,
    e2e.u('lp8_gest'), e2e.v('lp8_gest_reg')));
SELECT passo, situacao, left(coalesce(detalhe, ''), 140) FROM e2e.resultados WHERE passo LIKE 'LP8.%' AND em >= e2e.v('lp8_inicio')::timestamptz ORDER BY id;
