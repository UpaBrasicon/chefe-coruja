-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D12.
-- Administrador: só agregados, sem paciente.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D12.
--
-- Conta: admin.f5 (f5_admin, admin da Secretaria F5 desde o 46). Contraste:
-- gestor.upa.f5. Papéis de rede: secretaria.f5, regulacao.regional.f5 e
-- faturamento.rede.f5 (só leitura). Cuidados com a rede compartilhada:
--   • a unidade criada pelo admin ("UBS Teste Admin D12") é DESATIVADA no
--     mesmo script;
--   • a chave da API é criada e REVOGADA no mesmo script; o segredo não é
--     registrado (só o id e os nomes dos campos da resposta);
--   • publicar escala, trocar a chave da fila e zerar o 2FA de contas F5 NÃO
--     são exercidos (mexeriam em contas e escala dos outros blocos); só as
--     recusas com contas do bloco D.
--
-- Rodar antes: 47 e 49d (e os cenários D06 e D07, que dão contagens ao painel).
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/91_cenario_d12.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.d_guardar('d12_rodada', (coalesce(e2e.d_v('d12_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'd12\_%' AND nome <> 'd12_rodada';

-- ── 1 a 3. painel agregado ──────────────────────────────────────────────────
SELECT e2e.d_passo('D12.01.painel', 12, 'f5_admin', '/painel (OrganizacaoGrupo)', 'painel_organizacao(30): uma linha por unidade, só contagens (nenhuma coluna de paciente)',
  $q$SELECT e2e.d_confere(count(*) >= 1, count(*) || ' unidade(s): ' || string_agg(unidade_nome || ' [leitos ' || coalesce(leitos::text, 'sup') || ', porta ' || coalesce(porta_agora::text, 'sup')
      || ', chegadas ' || coalesce(chegadas_periodo::text, 'sup') || ', óbitos ' || coalesce(obitos_periodo::text, 'sup') || ', evasões ' || coalesce(evasoes_periodo::text, 'sup')
      || ', expediente ' || coalesce(profissionais_em_expediente::text, 'sup') || ']', '; '))
     FROM public.painel_organizacao(30)$q$);
SELECT e2e.d_passo('D12.01.sem_paciente', 12, 'banco', NULL, 'O retorno de painel_organizacao não tem coluna de nome, CNS ou CPF',
  $q$SELECT e2e.d_confere(pg_get_function_result('public.painel_organizacao(integer)'::regprocedure) NOT ILIKE ANY (ARRAY['%paciente%', '%cns%', '%cpf%', '%nome_paciente%']),
      pg_get_function_result('public.painel_organizacao(integer)'::regprocedure))$q$);
SELECT e2e.d_passo('D12.02.supressao', 12, 'f5_admin', '/painel', 'Contagens de paciente de 1 a 4 saem nulas (suprimidas); zero fica zero',
  $q$SELECT e2e.d_confere(NOT EXISTS (SELECT 1 FROM public.painel_organizacao(30) p, LATERAL (VALUES (p.leitos_ocupados), (p.porta_agora), (p.internados_agora), (p.chegadas_periodo),
          (p.encerrados_periodo), (p.obitos_periodo), (p.evasoes_periodo)) v(n) WHERE v.n BETWEEN 1 AND 4),
      'nenhuma contagem de 1 a 4; óbitos UPA F5 = ' || coalesce((SELECT obitos_periodo::text FROM public.painel_organizacao(30) WHERE unidade_nome = 'UPA Fase 5 24h'), 'suprimido')
      || '; evasões UPA F5 = ' || coalesce((SELECT evasoes_periodo::text FROM public.painel_organizacao(30) WHERE unidade_nome = 'UPA Fase 5 24h'), 'suprimido'))$q$);
SELECT e2e.d_passo('D12.02.suprimir', 12, 'banco', NULL, 'private.suprimir: 0 → 0, 1 a 4 → nulo, 5 → 5',
  $q$SELECT e2e.d_confere(private.suprimir(0) = 0 AND private.suprimir(1) IS NULL AND private.suprimir(4) IS NULL AND private.suprimir(5) = 5, 'ok')$q$);
SELECT e2e.d_passo('D12.03.expediente', 12, 'f5_admin', '/painel', 'profissionais_em_expediente sai sem supressão (é profissional, não paciente)',
  $q$SELECT string_agg(unidade_nome || ': ' || coalesce(profissionais_em_expediente::text, 'nulo'), '; ') FROM public.painel_organizacao(30)$q$);

-- ── 4. sem tela clínica ─────────────────────────────────────────────────────
SELECT e2e.d_passo('D12.04.prontuario', 12, 'f5_admin', '/prontuarios/:id', 'Admin tenta abrir o prontuário de uma paciente do bloco D (deve ser recusado)',
  format('SELECT left(public.abrir_prontuario(%L::uuid, NULL)::text, 80)', coalesce(e2e.d_v('d07_pac'), gen_random_uuid()::text)), 'erro');
SELECT e2e.d_passo('D12.04.ficha', 12, 'f5_admin', '/recepcao', 'Admin tenta abrir ficha na UPA F5 (deve ser recusado)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Teste de ficha pelo admin', NULL, '{"nome":"Teste Admin D12","data_nascimento":"1990-01-01","sexo":"M"}'::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011'), 'erro');
SELECT e2e.d_passo('D12.04.classificar', 12, 'f5_admin', '/triagem', 'Admin tenta classificar (deve ser recusado)',
  format($q$SELECT public.classificar_risco(%L::uuid, 'verde', '{}'::jsonb, NULL, NULL, '{}'::jsonb)::text$q$, coalesce(e2e.d_v('d07_ep'), gen_random_uuid()::text)), 'erro');
SELECT e2e.d_passo('D12.04.porta', 12, 'f5_admin', '/gestao', 'Admin tenta ler a porta da UPA F5 com nomes (deve ser recusado)',
  format('SELECT left(public.porta_agora(%L::uuid)::text, 80)', 'f5100000-0000-4000-8000-000000000002'), 'erro');
SELECT e2e.d_lacuna('D12.04.rotas', 12, 'f5_admin', 'RequireRole não abre /atendimento, /triagem, /recepcao, /prontuarios para o admin', 'Só na tela.');

-- ── 5. criar e editar unidade ───────────────────────────────────────────────
SELECT e2e.d_passo('D12.05.criar_unidade', 12, 'f5_admin', '/painel (admin)', 'Admin cria a unidade fictícia "UBS Teste Admin D12" na organização F5',
  format($q$SELECT public.admin_criar_unidade(%L::uuid, %L, 'ubs', NULL, 'Cidade Teste', 'SP')::text$q$,
    'f5000000-0000-4000-8000-000000000001', 'UBS Teste Admin D12' || CASE WHEN e2e.d_v('d12_rodada')::int > 1 THEN ' ' || e2e.d_v('d12_rodada') ELSE '' END), 'ok', 'd12_unidade');
SELECT e2e.d_dep('d12_unidade', 'D12.05.criar_unidade', 'D12.05.editar_unidade', 12, 'f5_admin', '/painel (admin)', 'Admin edita a unidade e a DESATIVA (para não ficar na rede dos outros blocos)',
  format($q$SELECT public.admin_editar_unidade(%L::uuid, %L, 'ubs', false, 'Cidade Teste', 'SP')::text$q$, e2e.d_v('d12_unidade'), 'UBS Teste Admin D12 (desativada)'));
SELECT e2e.d_dep('d12_unidade', 'D12.05.criar_unidade', 'D12.05.auditoria', 12, 'banco', NULL, 'Unidade criada inativa na organização F5; criação e edição na auditoria com autor = admin',
  format($q$SELECT e2e.d_confere(u.organizacao_id = 'f5000000-0000-4000-8000-000000000001' AND NOT u.ativo
        AND (SELECT count(*) FROM public.log_auditoria a WHERE a.entidade_id = u.id AND a.ator_id = 'f5200000-0000-4000-8000-000000000018') >= 2,
      u.nome || ', ativo ' || u.ativo || ', auditoria: ' || (SELECT string_agg(a.acao, ', ') FROM public.log_auditoria a WHERE a.entidade_id = u.id))
     FROM public.unidades u WHERE u.id = %L$q$, e2e.d_v('d12_unidade')));
SELECT e2e.d_dep('d12_unidade', 'D12.05.criar_unidade', 'D12.B2.unidade_vazia', 12, 'f5_admin', '/painel', 'Borda: unidade recém-criada sem leitos aparece com zeros (não nula)?',
  format($q$SELECT coalesce((SELECT 'leitos ' || coalesce(leitos::text, 'nulo') || ', chegadas ' || coalesce(chegadas_periodo::text, 'nulo') FROM public.painel_organizacao(30) WHERE unidade_id = %L::uuid), 'não aparece (inativa)')$q$, e2e.d_v('d12_unidade')));

-- ── 6. chave da API ─────────────────────────────────────────────────────────
SELECT e2e.d_passo('D12.06.criar_chave', 12, 'f5_admin', '/integracoes (Integracoes.tsx)', 'Admin cria chave da API com recurso financeiro (o segredo não é registrado aqui)',
  format($q$SELECT (SELECT r ->> 'id' FROM (SELECT public.api_criar_chave('Teste D12 (revogar)', 'teste', ARRAY[%L::uuid], ARRAY['financeiro'], NULL, NULL, 1) r) x)$q$,
    'f5100000-0000-4000-8000-000000000002'), 'ok', 'd12_chave');
SELECT e2e.d_dep('d12_chave', 'D12.06.criar_chave', 'D12.06.revogar_chave', 12, 'f5_admin', '/integracoes', 'Admin revoga a chave',
  format($q$SELECT public.api_revogar_chave(%L::uuid, 'Chave de teste do cenário D12, revogada no mesmo teste')::text$q$, e2e.d_v('d12_chave')));
SELECT e2e.d_dep('d12_chave', 'D12.06.criar_chave', 'D12.06.auditoria', 12, 'banco', NULL, 'Criação e revogação da chave na auditoria',
  format($q$SELECT e2e.d_confere(count(*) >= 2, string_agg(acao, ', ')) FROM public.log_auditoria WHERE entidade_id = %L::uuid$q$, e2e.d_v('d12_chave')));
SELECT e2e.d_lacuna('D12.06.segredo_uma_vez', 12, 'f5_admin', 'O segredo da chave aparece uma vez só', 'Só na tela (Integracoes.tsx).');

-- ── 7 a 9. escala, chave da fila e 2FA ──────────────────────────────────────
SELECT e2e.d_passo('D12.07.escala', 12, 'f5_admin', '/escala', 'Admin lê a escala de novembro da UPA F5',
  format($q$SELECT left(public.escala_mes_gestor(%L::uuid, 2026, 11)::text, 120)$q$, 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.d_lacuna('D12.07.publicar', 12, 'f5_admin', 'publicar_escala recusa como admin', 'Não exercitado de propósito: se o admin pudesse publicar, mexeria na escala F5 usada pelos outros blocos.');
SELECT e2e.d_passo('D12.08.chave_fila_fora', 12, 'f5_admin', '—', 'Admin tenta trocar a chave da fila de quem NÃO está nas suas unidades (enfermeiro do bloco D): recusa',
  format('SELECT public.trocar_chave_fila(%L::uuid)::text', 'fd200000-0000-4000-8000-000000000011'), 'erro:Acesso negado: só o administrador');
SELECT e2e.d_lacuna('D12.08.chave_fila_aceita', 12, 'f5_admin', 'Admin troca a chave da fila de alguém da sua unidade', 'Não exercitado: as pessoas da Secretaria F5 são contas usadas pelos outros blocos. Pelo código, vale para admin de unidade onde a pessoa tem vínculo ativo, ou super admin.');
SELECT e2e.d_passo('D12.09.zerar_fora', 12, 'f5_admin', '/unidade', 'Admin tenta zerar o 2FA de quem NÃO está nas suas unidades (farmacêutica do bloco D): recusa',
  format($q$SELECT public.zerar_segundo_fator(%L::uuid, 'teste do admin no cenário D12')::text$q$, 'fd200000-0000-4000-8000-000000000007'), 'erro:Só o gestor da unidade da pessoa');
SELECT e2e.d_lacuna('D12.09.zerar_aceita', 12, 'f5_admin', 'Admin zera o 2FA de alguém da sua unidade', 'Não exercitado (contas F5 dos outros blocos). Pelo código, zerar_segundo_fator aceita gestor OU admin da unidade da pessoa.');

-- ── 10. contraste com o gestor ──────────────────────────────────────────────
SELECT e2e.d_passo('D12.10.gestor_porta', 12, 'f5_ges_upa', '/gestao', 'O gestor vê a porta com pacientes nomeados (o admin não, D12.04.porta)',
  format($q$SELECT e2e.d_confere(public.porta_agora(%L::uuid)::text ILIKE '%%nome%%', left(public.porta_agora(%L::uuid)::text, 160))$q$,
    'f5100000-0000-4000-8000-000000000002', 'f5100000-0000-4000-8000-000000000002'));

-- ── 11. papéis de rede ──────────────────────────────────────────────────────
SELECT e2e.d_passo('D12.11.rede_contexto', 12, 'f5_secretaria', '/rede (Rede.tsx)', 'Secretaria lê o contexto da rede, sem nomes dos pacientes de teste',
  format($q$SELECT e2e.d_confere(r::text NOT ILIKE '%%Teste Óbito%%' AND r::text NOT ILIKE '%%Teste Evasão%%' AND r::text NOT ILIKE '%%Gestante A01%%', left(r::text, 200))
     FROM (SELECT public.rede_contexto(%L::uuid) r) x$q$, 'f5100000-0000-4000-8000-000000000008'));
SELECT e2e.d_passo('D12.11.rede_faturamento', 12, 'f5_fat_rede', '/rede (faturamento)', 'Faturamento da rede lê a competência 202611, sem nomes de paciente',
  format($q$SELECT e2e.d_confere(r::text NOT ILIKE '%%Teste Óbito%%' AND r::text NOT ILIKE '%%Teste Evasão%%' AND r::text NOT ILIKE '%%Gestante A01%%', left(r::text, 200))
     FROM (SELECT public.rede_faturamento(%L::uuid, '202611') r) x$q$, 'f5100000-0000-4000-8000-000000000008'));
SELECT e2e.d_passo('D12.11.mapa_vagas', 12, 'f5_reg_regional', '/rede (mapa de vagas)', 'Regulação regional lê o mapa de vagas, sem nomes de paciente',
  format($q$SELECT e2e.d_confere(r::text NOT ILIKE '%%Teste Óbito%%' AND r::text NOT ILIKE '%%Teste Evasão%%' AND r::text NOT ILIKE '%%Gestante A01%%', left(r::text, 200))
     FROM (SELECT public.regulacao_mapa_vagas(%L::uuid) r) x$q$, 'f5100000-0000-4000-8000-000000000008'));
SELECT e2e.d_lacuna('D12.11.arquivo', 12, 'f5_fat_rede', 'rede_baixar_arquivo de BPA fechado', 'Não exercitado nesta rodada (depende de competência fechada; Storage).');

-- ── 12. limites do período ──────────────────────────────────────────────────
SELECT e2e.d_passo('D12.12.limites', 12, 'f5_admin', '/painel', 'p_dias = 0 vale como 1 e p_dias = 400 vale como 365',
  $q$SELECT e2e.d_confere(
      (SELECT sum(coalesce(chegadas_periodo, -1)) FROM public.painel_organizacao(0)) IS NOT DISTINCT FROM (SELECT sum(coalesce(chegadas_periodo, -1)) FROM public.painel_organizacao(1))
      AND (SELECT sum(coalesce(chegadas_periodo, -1)) FROM public.painel_organizacao(400)) IS NOT DISTINCT FROM (SELECT sum(coalesce(chegadas_periodo, -1)) FROM public.painel_organizacao(365)),
      'chegadas: 0 dias = ' || (SELECT coalesce(sum(chegadas_periodo), 0) FROM public.painel_organizacao(0)) || ', 1 dia = ' || (SELECT coalesce(sum(chegadas_periodo), 0) FROM public.painel_organizacao(1))
      || ', 400 dias = ' || (SELECT coalesce(sum(chegadas_periodo), 0) FROM public.painel_organizacao(400)) || ', 365 dias = ' || (SELECT coalesce(sum(chegadas_periodo), 0) FROM public.painel_organizacao(365)))$q$);
SELECT e2e.d_passo('D12.B1.so_unidades_do_admin', 12, 'f5_admin', '/painel', 'Borda: o admin comum só vê as unidades da sua organização (nenhuma do bloco D)',
  $q$SELECT e2e.d_confere(NOT EXISTS (SELECT 1 FROM public.painel_organizacao(30) WHERE unidade_id::text LIKE 'fd1%'), 'sem unidades de outra organização')$q$);

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D12.%' AND em >= now() GROUP BY 1;
