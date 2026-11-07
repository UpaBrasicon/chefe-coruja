-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D04.
-- Troca de plantão: colega aceita, gestor aprova, a porta segue a escala nova.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D04.
--
-- Roda na UPA Bloco D com as contas do bloco (49d): plantonista A
-- (escala.d.f5), plantonista B (escala2.d.f5) e gestor.d.f5. As trocas são de
-- plantões de AMANHÃ criados aqui; a escala das contas F5 não é tocada.
--
-- Passo 9 (gestor aprova a própria troca com 2º fator): a chave mestra
-- exigir_segundo_fator está DESLIGADA na homologação. O script a liga DENTRO
-- da sua transação (ninguém fora dela vê a mudança) e a desliga antes do fim;
-- a confirmação do código é simulada com uma linha em
-- private.segundo_fator_sessao_ok da conta gestor.d.f5 (o que a RPC
-- verificar_codigo_2fa grava depois de um TOTP válido). Ajustes registrados.
--
-- Rodar antes: 47 e 49d.
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/83_cenario_d04.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.d_guardar('d04_rodada', (coalesce(e2e.d_v('d04_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'd04\_%' AND nome <> 'd04_rodada';
DELETE FROM e2e.vars WHERE nome = 'd_claims_d_ges';
-- amanhã na 1ª rodada; nas seguintes, um dia a mais por rodada (plantões novos)
SELECT e2e.d_guardar('d04_data', (private.data_atual() + e2e.d_v('d04_rodada')::int)::text);

CREATE OR REPLACE FUNCTION e2e.d04_sql_escala(p_conta text, p_setor uuid, p_turno text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format($q$SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, %L, NULL, false, 'plantonista')::text$q$,
    'fd100000-0000-4000-8000-000000000001', p_setor, e2e.d_conta(p_conta), e2e.d_v('d04_data'), p_turno)
$$;
CREATE OR REPLACE FUNCTION e2e.d04_aviso(p_perfil text, p_tipo text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format($q$SELECT e2e.d_confere(count(*) >= 1, count(*) || ' aviso(s) "' || %L || '" no sino') FROM public.notificacoes_plantonista
                   WHERE perfil_id = %L AND tipo = %L$q$, p_tipo, e2e.d_conta(p_perfil), p_tipo)
$$;

-- ── 0. plantões de amanhã: A na manhã do PS D, B na manhã da Internação D ──
SELECT e2e.d_passo('D04.00.escala_a', 4, 'd_ges', '/escala (EscalaMes)', 'Gestor escala a plantonista A na manhã de amanhã, Pronto Socorro D',
  e2e.d04_sql_escala('d_plant_a', 'fd300000-0000-4000-8000-000000000011', 'manha'), 'ok', 'd04_pa');
SELECT e2e.d_passo('D04.00.escala_b', 4, 'd_ges', '/escala (EscalaMes)', 'Gestor escala a plantonista B na manhã de amanhã, Internação D',
  e2e.d04_sql_escala('d_plant_b', 'fd300000-0000-4000-8000-000000000013', 'manha'), 'ok', 'd04_pb');
SELECT e2e.d_passo('D04.00.exige_aprovacao', 4, 'banco', NULL, 'escala_passagem_exige_aprovacao da UPA Bloco D no padrão (sem linha = exige)',
  $q$SELECT e2e.d_confere(coalesce((SELECT valor FROM public.configuracoes_unidade WHERE unidade_id = 'fd100000-0000-4000-8000-000000000001' AND chave = 'escala_passagem_exige_aprovacao'), 'true') = 'true', 'exige aprovação')$q$);

-- ── 1. pedido de troca ──────────────────────────────────────────────────────
SELECT e2e.d_dep('d04_pb', 'D04.00.escala_b', 'D04.01.solicitar', 4, 'd_plant_a', '/agenda?aba=vagas (PedidosEscala)', 'A pede a troca: "compromisso pessoal"',
  format($q$SELECT public.solicitar_troca(%L::uuid, %L::uuid, 'compromisso pessoal')::text$q$, e2e.d_v('d04_pa'), e2e.d_v('d04_pb')), 'ok', 'd04_t1');
SELECT e2e.d_dep('d04_t1', 'D04.01.solicitar', 'D04.01.pendente', 4, 'banco', NULL, 'Troca pendente, sem aceite',
  format($q$SELECT e2e.d_confere(status = 'pendente' AND aceito_em IS NULL, 'status ' || status) FROM public.trocas_plantao WHERE id = %L$q$, e2e.d_v('d04_t1')));
SELECT e2e.d_dep('d04_t1', 'D04.01.solicitar', 'D04.01.aviso_b', 4, 'banco', NULL, 'B recebe o aviso no sino', e2e.d04_aviso('d_plant_b', 'troca_pedida_' || e2e.d_v('d04_t1')));

-- ── 3. gestor tenta aprovar antes do aceite (segunda troca, só para isso) ──
-- (o par de plantões é único em trocas_plantao: a segunda troca usa os plantões da noite de amanhã)
SELECT e2e.d_passo('D04.03.escala_a_noite', 4, 'd_ges', '/escala', 'Gestor escala A na noite de amanhã, PS D',
  e2e.d04_sql_escala('d_plant_a', 'fd300000-0000-4000-8000-000000000011', 'noite'), 'ok', 'd04_pa_n');
SELECT e2e.d_passo('D04.03.escala_b_noite', 4, 'd_ges', '/escala', 'Gestor escala B na noite de amanhã, Internação D',
  e2e.d04_sql_escala('d_plant_b', 'fd300000-0000-4000-8000-000000000013', 'noite'), 'ok', 'd04_pb_n');
SELECT e2e.d_dep('d04_pb_n', 'D04.03.escala_b_noite', 'D04.03.segunda_troca', 4, 'd_plant_a', 'PedidosEscala', 'A abre uma segunda troca, com os plantões da noite (para os passos 3 e 6)',
  format($q$SELECT public.solicitar_troca(%L::uuid, %L::uuid, 'segunda troca de teste')::text$q$, e2e.d_v('d04_pa_n'), e2e.d_v('d04_pb_n')), 'ok', 'd04_t2');
SELECT e2e.d_dep('d04_t2', 'D04.03.segunda_troca', 'D04.03.aprovar_antes', 4, 'd_ges', '/escala (Pedidos)', 'Gestor tenta aprovar antes do aceite do colega (deve ser recusado)',
  format('SELECT public.aprovar_troca(%L::uuid)::text', e2e.d_v('d04_t2')), 'erro:O colega ainda não aceitou');

-- ── 2. B aceita ─────────────────────────────────────────────────────────────
SELECT e2e.d_dep('d04_t1', 'D04.01.solicitar', 'D04.02.aceitar', 4, 'd_plant_b', 'PedidosParaVoce', 'B aceita a troca: vai ao gestor',
  format('SELECT public.aceitar_troca(%L::uuid)::text', e2e.d_v('d04_t1')));
SELECT e2e.d_dep('d04_t1', 'D04.01.solicitar', 'D04.02.aceito_em', 4, 'banco', NULL, 'aceito_em gravado; A e o gestor avisados',
  format($q$SELECT e2e.d_confere(t.aceito_em IS NOT NULL AND t.status = 'pendente'
      AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista n WHERE n.perfil_id = %L AND n.tipo = 'troca_aceita_' || t.id)
      AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista n WHERE n.perfil_id = %L AND n.tipo = 'troca_aceita_' || t.id),
      'aceita em ' || to_char(t.aceito_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || '; A e gestor avisados')
     FROM public.trocas_plantao t WHERE t.id = %L$q$, 'fd200000-0000-4000-8000-000000000001', 'fd200000-0000-4000-8000-000000000005', e2e.d_v('d04_t1')));
SELECT e2e.d_dep('d04_t1', 'D04.01.solicitar', 'D04.02.sai_da_lista', 4, 'd_plant_b', 'PedidosParaVoce', 'pedidos_para_mim de B não traz mais a troca aceita',
  format($q$SELECT e2e.d_confere(NOT EXISTS (SELECT 1 FROM public.pedidos_para_mim(%L::uuid) x WHERE x::text LIKE '%%' || %L || '%%'), 'fora da lista de B')$q$,
    'fd100000-0000-4000-8000-000000000001', e2e.d_v('d04_t1')));

-- ── 4 e 5. gestor aprova; a escala troca ────────────────────────────────────
SELECT e2e.d_dep('d04_t1', 'D04.01.solicitar', 'D04.04.aprovar', 4, 'd_ges', '/escala (Pedidos)', 'Gestor aprova a troca aceita',
  format('SELECT public.aprovar_troca(%L::uuid)::text', e2e.d_v('d04_t1')));
SELECT e2e.d_dep('d04_t1', 'D04.01.solicitar', 'D04.04.escala_trocada', 4, 'banco', NULL, 'Amanhã: A na Internação D e B no PS D; troca aprovada; os dois avisados; histórico',
  format($q$SELECT e2e.d_confere(
      (SELECT perfil_id FROM public.escala_plantao WHERE id = %L) = %L AND (SELECT perfil_id FROM public.escala_plantao WHERE id = %L) = %L
      AND (SELECT status FROM public.trocas_plantao WHERE id = %L) = 'aprovado'
      AND (SELECT count(*) FROM public.notificacoes_plantonista WHERE tipo = 'troca_decidida_' || %L) >= 2
      AND EXISTS (SELECT 1 FROM public.historico_escala WHERE acao = 'troca_aprovada' AND dados ->> 'troca_id' = %L),
      'plantão do PS D agora de B, da Internação D agora de A; aprovado; 2 avisos; histórico troca_aprovada')$q$,
    e2e.d_v('d04_pa'), 'fd200000-0000-4000-8000-000000000002', e2e.d_v('d04_pb'), 'fd200000-0000-4000-8000-000000000001',
    e2e.d_v('d04_t1'), e2e.d_v('d04_t1'), e2e.d_v('d04_t1')));
SELECT e2e.d_passo('D04.05.escala_de_a', 4, 'd_plant_a', '/minha-escala', 'A lê a própria escala da manhã de amanhã: Internação D',
  format($q$SELECT e2e.d_confere(string_agg(s.nome, ',') = 'Internação D', 'amanhã: ' || coalesce(string_agg(s.nome || ' (' || e.turno || ')', ', '), 'nada'))
     FROM public.escala_plantao e JOIN public.setores s ON s.id = e.setor_id WHERE e.perfil_id = auth.uid() AND e.data = %L AND e.turno = 'manha' AND e.ativo$q$, e2e.d_v('d04_data')));

-- ── 6. B recusa a segunda troca ─────────────────────────────────────────────
SELECT e2e.d_dep('d04_t2', 'D04.03.segunda_troca', 'D04.06.recusar', 4, 'd_plant_b', 'PedidosParaVoce', 'B recusa a segunda troca com motivo',
  format($q$SELECT public.recusar_troca(%L::uuid, 'não posso nesse dia')::text$q$, e2e.d_v('d04_t2')));
SELECT e2e.d_dep('d04_t2', 'D04.03.segunda_troca', 'D04.06.recusada', 4, 'banco', NULL, 'Troca recusada e A avisado',
  format($q$SELECT e2e.d_confere(t.status = 'recusado' AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista n WHERE n.perfil_id = %L AND n.tipo = 'troca_decidida_' || t.id),
      'status ' || t.status) FROM public.trocas_plantao t WHERE t.id = %L$q$, 'fd200000-0000-4000-8000-000000000001', e2e.d_v('d04_t2')));

-- ── 7. A cancela uma troca ainda sem decisão ────────────────────────────────
SELECT e2e.d_dep('d04_t1', 'D04.01.solicitar', 'D04.07.terceira_troca', 4, 'd_plant_a', 'PedidosEscala', 'A (agora na Internação D) pede outra troca com B',
  format($q$SELECT public.solicitar_troca(%L::uuid, %L::uuid, 'teste de cancelamento')::text$q$, e2e.d_v('d04_pb'), e2e.d_v('d04_pa')), 'ok', 'd04_t3');
SELECT e2e.d_dep('d04_t3', 'D04.07.terceira_troca', 'D04.07.cancelar', 4, 'd_plant_a', 'PedidosEscala', 'A cancela a troca ainda sem decisão',
  format('SELECT public.cancelar_troca(%L::uuid)::text', e2e.d_v('d04_t3')));
SELECT e2e.d_dep('d04_t3', 'D04.07.terceira_troca', 'D04.07.cancelada', 4, 'banco', NULL, 'Troca cancelada',
  format($q$SELECT e2e.d_confere(status IN ('cancelado', 'cancelada'), 'status ' || status) FROM public.trocas_plantao WHERE id = %L$q$, e2e.d_v('d04_t3')));
SELECT e2e.d_dep('d04_t3', 'D04.07.terceira_troca', 'D04.07.pedir_de_novo', 4, 'd_plant_a', 'PedidosEscala', 'Depois de cancelar, A pede de novo a MESMA troca (mesmo par de plantões)',
  format($q$SELECT public.solicitar_troca(%L::uuid, %L::uuid, 'pedido de novo depois de cancelar')::text$q$, e2e.d_v('d04_pb'), e2e.d_v('d04_pa')));

-- ── 8. escrita direta na tabela ─────────────────────────────────────────────
SELECT e2e.d_dep('d04_t3', 'D04.07.terceira_troca', 'D04.08.update_direto', 4, 'd_plant_b', 'SQL como B', 'B tenta UPDATE direto em trocas_plantao (deve ser recusado)',
  format($q$UPDATE public.trocas_plantao SET status = 'aprovado' WHERE id = %L RETURNING id::text$q$, e2e.d_v('d04_t3')), 'erro');

-- ── 9. o gestor parte do pedido: aprovação só com 2º fator ──────────────────
SELECT e2e.d_ajuste('D04.09.vinculo_plantonista', 4, 'Gestor do bloco D ganha também o papel plantonista na UPA Bloco D (conta do bloco D)',
  $q$INSERT INTO public.vinculos (perfil_id, unidade_id, papel) SELECT 'fd200000-0000-4000-8000-000000000005', 'fd100000-0000-4000-8000-000000000001', 'plantonista'
     WHERE NOT EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = 'fd200000-0000-4000-8000-000000000005' AND unidade_id = 'fd100000-0000-4000-8000-000000000001' AND papel = 'plantonista')$q$);
SELECT e2e.d_passo('D04.09.escala_gestor', 4, 'd_ges', '/escala', 'Gestor se escala na tarde de amanhã, PS D (como plantonista)',
  e2e.d04_sql_escala('d_ges', 'fd300000-0000-4000-8000-000000000011', 'tarde'), 'ok', 'd04_pg');
SELECT e2e.d_passo('D04.09.escala_a_tarde', 4, 'd_ges', '/escala', 'Gestor escala A na tarde de amanhã, Internação D',
  e2e.d04_sql_escala('d_plant_a', 'fd300000-0000-4000-8000-000000000013', 'tarde'), 'ok', 'd04_pa2');
SELECT e2e.d_dep('d04_pg', 'D04.09.escala_gestor', 'D04.09.solicitar', 4, 'd_ges', 'PedidosEscala', 'Gestor pede troca do próprio plantão com A',
  format($q$SELECT public.solicitar_troca(%L::uuid, %L::uuid, 'troca pedida pelo gestor')::text$q$, e2e.d_v('d04_pg'), e2e.d_v('d04_pa2')), 'ok', 'd04_t4');
SELECT e2e.d_dep('d04_t4', 'D04.09.solicitar', 'D04.09.a_aceita', 4, 'd_plant_a', 'PedidosParaVoce', 'A aceita a troca do gestor',
  format('SELECT public.aceitar_troca(%L::uuid)::text', e2e.d_v('d04_t4')));
SELECT e2e.d_ajuste('D04.09.liga_2fa', 4, 'Liga exigir_segundo_fator SÓ dentro desta transação (homologação tem a chave desligada; volta a false no fim do script)',
  $q$UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator'$q$);
SELECT e2e.d_dep('d04_t4', 'D04.09.solicitar', 'D04.09.sem_2fa', 4, 'd_ges', '/escala (Pedidos)', 'Gestor aprova a própria troca sem 2º fator válido (deve ser recusado)',
  format('SELECT public.aprovar_troca(%L::uuid)::text', e2e.d_v('d04_t4')), 'erro:SEGUNDO_FATOR');
SELECT e2e.d_guardar('d04_sessao_ges', gen_random_uuid()::text);
SELECT e2e.d_ajuste('D04.09.simula_codigo', 4, 'Simula o código TOTP confirmado pelo gestor do bloco D (linha em segundo_fator_sessao_ok da sessão de teste)',
  format('INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES (%L, %L, now())', e2e.d_v('d04_sessao_ges'), 'fd200000-0000-4000-8000-000000000005'));
SELECT e2e.d_guardar('d_claims_d_ges', jsonb_build_object('session_id', e2e.d_v('d04_sessao_ges'))::text);
SELECT e2e.d_dep('d04_t4', 'D04.09.solicitar', 'D04.09.com_2fa', 4, 'd_ges', '/escala (Pedidos)', 'Com o 2º fator válido, o gestor aprova a própria troca',
  format('SELECT public.aprovar_troca(%L::uuid)::text', e2e.d_v('d04_t4')));
SELECT e2e.d_dep('d04_t4', 'D04.09.solicitar', 'D04.09.registro_proprio', 4, 'banco', NULL, 'Histórico da escala e auditoria com aprovou_proprio_pedido',
  format($q$SELECT e2e.d_confere(EXISTS (SELECT 1 FROM public.historico_escala WHERE acao = 'aprovou_proprio_pedido' AND dados ->> 'troca_id' = %L)
      AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'aprovou_proprio_pedido' AND entidade_id = %L::uuid AND ator_id = %L),
      'histórico e auditoria aprovou_proprio_pedido')$q$, e2e.d_v('d04_t4'), e2e.d_v('d04_t4'), 'fd200000-0000-4000-8000-000000000005'));
DELETE FROM e2e.vars WHERE nome = 'd_claims_d_ges';
SELECT e2e.d_ajuste('D04.09.desliga_2fa', 4, 'exigir_segundo_fator volta a false (estado da homologação)',
  $q$UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator'$q$);

-- ── 10. porta no dia trocado ────────────────────────────────────────────────
SELECT e2e.d_lacuna('D04.10.porta_no_dia', 4, 'd_plant_a', 'No dia trocado, A entra pela Internação D (setores_na_escala_agora segue a escala nova)',
  'Só no dia (amanhã, 07h): a porta é a escala_plantao do momento (plantoes_na_janela por perfil_id), e o passo D04.04/05 mostra o plantão já com A na Internação D. Mover o início para agora esbarra na sobreposição com o plantão da noite de A (D09).');

-- ── bordas (plantões de depois de amanhã: o par de plantões é único em trocas_plantao) ──
CREATE OR REPLACE FUNCTION e2e.d04_sql_escala_d2(p_conta text, p_setor uuid, p_turno text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format($q$SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, %L, NULL, false, 'plantonista')::text$q$,
    'fd100000-0000-4000-8000-000000000001', p_setor, e2e.d_conta(p_conta), e2e.d_v('d04_data')::date + 1, p_turno)
$$;
SELECT e2e.d_passo('D04.B1.escala_a', 4, 'd_ges', '/escala', 'A na manhã de depois de amanhã, PS D', e2e.d04_sql_escala_d2('d_plant_a', 'fd300000-0000-4000-8000-000000000011', 'manha'), 'ok', 'd04_pa_b1');
SELECT e2e.d_passo('D04.B1.escala_b', 4, 'd_ges', '/escala', 'B na manhã de depois de amanhã, Internação D', e2e.d04_sql_escala_d2('d_plant_b', 'fd300000-0000-4000-8000-000000000013', 'manha'), 'ok', 'd04_pb_b1');
SELECT e2e.d_ajuste('D04.B1.sem_aprovacao', 4, 'UPA Bloco D passa a não exigir aprovação do gestor na troca',
  $q$INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor) VALUES ('fd100000-0000-4000-8000-000000000001', 'escala_passagem_exige_aprovacao', 'false')
     ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = 'false'$q$);
SELECT e2e.d_dep('d04_pb_b1', 'D04.B1.escala_b', 'D04.B1.solicitar', 4, 'd_plant_a', 'PedidosEscala', 'A pede a troca (PS D ↔ Internação D, depois de amanhã)',
  format($q$SELECT public.solicitar_troca(%L::uuid, %L::uuid, 'troca sem aprovação do gestor')::text$q$, e2e.d_v('d04_pa_b1'), e2e.d_v('d04_pb_b1')), 'ok', 'd04_t5');
SELECT e2e.d_dep('d04_t5', 'D04.B1.solicitar', 'D04.B1.aceite_aplica', 4, 'd_plant_b', 'PedidosParaVoce', 'Sem exigência de aprovação, o aceite do colega já aplica a troca',
  format($q$SELECT e2e.d_confere(public.aceitar_troca(%L::uuid) = 'aplicada', 'aceitar_troca devolveu "aplicada"')$q$, e2e.d_v('d04_t5')));
SELECT e2e.d_ajuste('D04.B1.volta_padrao', 4, 'UPA Bloco D volta ao padrão (exige aprovação)',
  $q$DELETE FROM public.configuracoes_unidade WHERE unidade_id = 'fd100000-0000-4000-8000-000000000001' AND chave = 'escala_passagem_exige_aprovacao'$q$);
-- sobreposição: depois da B1, A está na manhã da Internação D; A troca a sua tarde (PS D) pela manhã de B (PS D) → A ficaria em dois setores na manhã
SELECT e2e.d_passo('D04.B2.escala_a_tarde', 4, 'd_ges', '/escala', 'A na tarde de depois de amanhã, PS D', e2e.d04_sql_escala_d2('d_plant_a', 'fd300000-0000-4000-8000-000000000011', 'tarde'), 'ok', 'd04_pa_b2');
SELECT e2e.d_dep('d04_pa_b2', 'D04.B2.escala_a_tarde', 'D04.B2.solicitar', 4, 'd_plant_a', 'PedidosEscala', 'A pede trocar a sua tarde pela manhã de B (A já está na manhã)',
  format($q$SELECT public.solicitar_troca(%L::uuid, %L::uuid, 'troca que sobrepõe')::text$q$, e2e.d_v('d04_pa_b2'), e2e.d_v('d04_pa_b1')), 'ok', 'd04_t6');
SELECT e2e.d_dep('d04_t6', 'D04.B2.solicitar', 'D04.B2.aceitar', 4, 'd_plant_b', 'PedidosParaVoce', 'B aceita',
  format('SELECT public.aceitar_troca(%L::uuid)::text', e2e.d_v('d04_t6')));
SELECT e2e.d_dep('d04_t6', 'D04.B2.solicitar', 'D04.B2.sobreposicao', 4, 'd_ges', '/escala (Pedidos)', 'Gestor aprova a troca que deixaria A em dois setores na mesma manhã (deve ser recusado pela escala)',
  format('SELECT public.aprovar_troca(%L::uuid)::text', e2e.d_v('d04_t6')), 'erro');
SELECT e2e.d_lacuna('D04.B3.passagem', 4, 'd_plant_a', 'Passagem de plantão (passar_plantao → aceitar_passagem/recusar_passagem/cancelar_pedido_escala)',
  'Não exercitada nesta rodada: o desenho é o mesmo da troca; fica para a tela ou para uma rodada própria.');

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D04.%' AND em >= now() GROUP BY 1;
