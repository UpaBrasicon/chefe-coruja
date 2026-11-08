-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do achado D P2-2 (D04.07) depois da
-- 20270308000002_troca_pedida_de_novo.sql (decisão do RT em 08/11/2026: A em
-- T1 e T2). Usa o cenário do 83_cenario_d04.sql (variáveis d04_pa e d04_pb):
-- A pede a troca, cancela, pede de novo a MESMA troca (antes: unicidade crua);
-- com o pedido pendente, repetir é recusado com mensagem clara; no fim, A
-- cancela o pedido (limpeza).
-- Rodar antes: 41_checkin_fase5.sql; e o 83 já rodado (as variáveis d04_*).
-- ════════════════════════════════════════════════════════════════════════════
SELECT e2e.b_guardar('d04r_inicio', now()::text);
-- ── 7. A cancela uma troca ainda sem decisão ────────────────────────────────
SELECT e2e.d_dep('d04_t1', 'D04.01.solicitar', 'D04.07.terceira_troca', 4, 'd_plant_a', 'PedidosEscala', 'A (agora na Internação D) pede outra troca com B',
  format($q$SELECT public.solicitar_troca(%L::uuid, %L::uuid, 'teste de cancelamento')::text$q$, e2e.d_v('d04_pb'), e2e.d_v('d04_pa')), 'ok', 'd04_t3');
SELECT e2e.d_dep('d04_t3', 'D04.07.terceira_troca', 'D04.07.cancelar', 4, 'd_plant_a', 'PedidosEscala', 'A cancela a troca ainda sem decisão',
  format('SELECT public.cancelar_troca(%L::uuid)::text', e2e.d_v('d04_t3')));
SELECT e2e.d_dep('d04_t3', 'D04.07.terceira_troca', 'D04.07.cancelada', 4, 'banco', NULL, 'Troca cancelada',
  format($q$SELECT e2e.d_confere(status IN ('cancelado', 'cancelada'), 'status ' || status) FROM public.trocas_plantao WHERE id = %L$q$, e2e.d_v('d04_t3')));
SELECT e2e.d_dep('d04_t3', 'D04.07.terceira_troca', 'D04.07.pedir_de_novo', 4, 'd_plant_a', 'PedidosEscala', 'Depois de cancelar, A pede de novo a MESMA troca (mesmo par de plantões)',
  format($q$SELECT public.solicitar_troca(%L::uuid, %L::uuid, 'pedido de novo depois de cancelar')::text$q$, e2e.d_v('d04_pb'), e2e.d_v('d04_pa')));
SELECT e2e.d_dep('d04_t3', 'D04.07.terceira_troca', 'D04.07.pedido_repetido', 4, 'd_plant_a', 'PedidosEscala', 'Com o pedido de novo pendente, A repete (deve ser recusado com mensagem clara)',
  format($q$SELECT public.solicitar_troca(%L::uuid, %L::uuid, 'repetido')::text$q$, e2e.d_v('d04_pb'), e2e.d_v('d04_pa')), 'erro:Já há um pedido de troca pendente');
SELECT e2e.d_dep('d04_t3', 'D04.07.terceira_troca', 'D04.07.limpeza', 4, 'd_plant_a', 'PedidosEscala', 'A cancela o pedido de novo (limpeza)',
  format($q$SELECT public.cancelar_troca(t.id)::text FROM public.trocas_plantao t WHERE t.plantao_a_id = %L AND t.plantao_b_id = %L AND t.status = 'pendente'$q$, e2e.d_v('d04_pb'), e2e.d_v('d04_pa')));
SELECT passo, situacao, left(coalesce(detalhe, ''), 120) AS detalhe FROM e2e.resultados WHERE passo LIKE 'D04.07.%' AND em >= e2e.v('d04r_inicio')::timestamptz ORDER BY id;
