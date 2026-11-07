-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D02.
-- Fim do plantão: 20 min, bloqueio e liberação pelo gestor.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D02.
--
-- Roda na UPA Bloco D com as contas do bloco (49d). O plantonista do cenário é
-- a plantonista B (escala2.d.f5): a escala das contas F5 não é tocada.
-- Transação única: "o fim do plantão" é simulado movendo o INÍCIO do plantão
-- da conta do bloco D (ajuste registrado); a liberação "vencida" é simulada
-- movendo o expira_em da liberação do próprio cenário. No fim, o início volta.
--
-- Paciente fictício novo por rodada ("Carlos Teste Fim de Turno"). A cor da
-- classificação é a escolha da enfermeira de teste (amarelo). Sem prescrição.
--
-- Rodar antes: 47, 49d e 80 (o D01 deixa recepção e enfermagem do bloco D com
-- check-in no turno em curso). Se o D01 não rodou neste turno, este script
-- escala e faz o check-in delas também.
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/81_cenario_d02.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.d_guardar('d02_rodada', (coalesce(e2e.d_v('d02_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'd02\_%' AND nome <> 'd02_rodada';
SELECT e2e.d_guardar('d02_nome', 'Carlos Teste Fim de Turno' || CASE WHEN e2e.d_v('d02_rodada')::int > 1 THEN ' ' || chr(64 + e2e.d_v('d02_rodada')::int) ELSE '' END);
SELECT e2e.d_guardar('d02_cadastro', jsonb_build_object('nome', e2e.d_v('d02_nome'), 'data_nascimento', '1970-09-12', 'sexo', 'M',
  'raca_cor', 'parda', 'cns', e2e.d_cns(9820 + e2e.d_v('d02_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste D02', 'endereco', 'Rua do Teste, 2',
  'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.d_guardar('d02_data', private.data_do_turno(now())::text);
SELECT e2e.d_guardar('d02_turno', CASE WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '07:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < '13:00' THEN 'manha'
                                       WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '13:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < '19:00' THEN 'tarde'
                                       ELSE 'noite' END);

-- plantão do bloco D no turno em curso (cria ou reaproveita) e check-in pela RPC
CREATE OR REPLACE FUNCTION e2e.d02_plantao(p_passo text, p_conta text, p_papel text, p_guardar text, p_checkin boolean) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  SELECT id::text INTO r FROM public.escala_plantao WHERE perfil_id = e2e.d_conta(p_conta) AND setor_id = 'fd300000-0000-4000-8000-000000000011'
     AND data = e2e.d_v('d02_data')::date AND turno = e2e.d_v('d02_turno') AND ativo;
  IF r IS NULL THEN
    PERFORM e2e.d_passo(p_passo, 2, 'd_ges', '/escala (EscalaMes)', 'Gestor escala ' || p_conta || ' (' || p_papel || ') no turno em curso',
      format($q$SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, %L, NULL, false, %L)::text$q$,
        'fd100000-0000-4000-8000-000000000001', 'fd300000-0000-4000-8000-000000000011', e2e.d_conta(p_conta), e2e.d_v('d02_data'), e2e.d_v('d02_turno'), p_papel), 'ok', p_guardar);
  ELSE
    PERFORM e2e.d_guardar(p_guardar, r);
  END IF;
  IF p_checkin AND private.checkin_do_plantao(e2e.d_u(p_guardar)) IS NULL THEN
    PERFORM e2e.d_passo(p_passo || '_checkin', 2, p_conta, '/plantao/check-in', 'Check-in de ' || p_conta || ' no turno em curso',
      format($q$SELECT public.registrar_checkin(%L::uuid, NULL, NULL, NULL, NULL)::text$q$, 'fd100000-0000-4000-8000-000000000001'));
  END IF;
  RETURN e2e.d_v(p_guardar);
END $$;
-- o plantão da plantonista B termina (ou terminou) N minutos antes de agora
CREATE OR REPLACE FUNCTION e2e.d02_fim(p_passo text, p_min int) RETURNS text LANGUAGE sql AS $$
  SELECT e2e.d_ajuste(p_passo, 2, CASE WHEN p_min < 0 THEN 'Plantão da plantonista B em curso (termina daqui a ' || -p_min || ' min)'
                                       ELSE 'Plantão da plantonista B terminou há ' || p_min || ' min (simulado pelo início)' END,
    format('UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => duracao_min + %s) WHERE id = %L AND perfil_id::text LIKE %L',
      p_min, e2e.d_v('d02_pl_b'), 'fd200000%'))
$$;

-- ── pré-condições: recepção, enfermagem e plantonista B com check-in ────────
SELECT e2e.d02_plantao('D02.00.rec', 'd_rec', 'recepcao', 'd02_pl_rec', true);
SELECT e2e.d02_plantao('D02.00.enf', 'd_enf', 'enfermeiro', 'd02_pl_enf', true);
SELECT e2e.d02_plantao('D02.00.plant_b', 'd_plant_b', 'plantonista', 'd02_pl_b', false);
-- liberações de rodadas anteriores ainda ativas reabririam a porta: vencem antes de começar (e no fim)
CREATE OR REPLACE FUNCTION e2e.d02_vence_liberacoes(p_passo text) RETURNS text LANGUAGE sql AS $$
  SELECT e2e.d_ajuste(p_passo, 2, 'Vence as liberações ainda ativas da plantonista B na UPA Bloco D (rodadas anteriores ou deste script)',
    format('UPDATE public.liberacao_pos_plantao SET concedido_em = now() - interval %L, expira_em = now() - interval %L WHERE perfil_id = %L AND unidade_id = %L AND expira_em > now() - interval %L',
      '6 minutes', '1 minute', 'fd200000-0000-4000-8000-000000000002', 'fd100000-0000-4000-8000-000000000001', '1 minute'))
$$;
SELECT e2e.d02_vence_liberacoes('D02.00.vence_liberacoes');
SELECT e2e.d02_fim('D02.00.em_curso', -60);
SELECT e2e.d_passo('D02.00.plant_b_checkin', 2, 'd_plant_b', '/plantao/check-in', 'Plantonista B faz o check-in do plantão em curso',
  format($q$SELECT public.registrar_checkin(%L::uuid, NULL, NULL, NULL, NULL)::text$q$, 'fd100000-0000-4000-8000-000000000001'), 'ok', 'd02_pres_b');
SELECT e2e.d_passo('D02.00.ficha', 2, 'd_rec', '/recepcao (Nova ficha)', 'Recepção abre a ficha de Carlos no Pronto Socorro D',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor de cabeça e tontura', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'fd300000-0000-4000-8000-000000000011', e2e.d_v('d02_cadastro')), 'ok', 'd02_ep');
SELECT e2e.d_dep('d02_ep', 'D02.00.ficha', 'D02.00.chamar', 2, 'd_enf', '/triagem (Fila)', 'Enfermeira chama Carlos',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.d_v('d02_ep'), 'fd400000-0000-4000-8000-000000000001'));
SELECT e2e.d_dep('d02_ep', 'D02.00.ficha', 'D02.00.classificar', 2, 'd_enf', '/triagem (Classificar)', 'Classifica: "Dor de cabeça" (adulto), sinais crus; cor amarelo = escolha da enfermeira de teste',
  format($q$SELECT public.classificar_risco(%L::uuid, 'amarelo',
    '{"frequencia-cardiaca":88,"frequencia-respiratoria":18,"temperatura":36.7,"saturacao-o2":97,"escala-dor":6,"pressao-arterial-sistolica":150,"pressao-arterial-diastolica":95}'::jsonb,
    %L::uuid, e2e.disc(%L::uuid, %L::uuid, 'amarelo'), '{}'::jsonb)::text$q$,
    e2e.d_v('d02_ep'), '5cad8e39-22e4-4732-893a-3313e2329103', 'fd100000-0000-4000-8000-000000000001', '5cad8e39-22e4-4732-893a-3313e2329103'));

-- ── 1. assume antes do fim e salva rascunho ─────────────────────────────────
SELECT e2e.d_dep('d02_ep', 'D02.00.ficha', 'D02.01.iniciar', 2, 'd_plant_b', '/atendimento (JanelaAtendimento)', 'Plantonista B assume Carlos antes do fim do turno',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.d_v('d02_ep')));
SELECT e2e.d_dep('d02_ep', 'D02.00.ficha', 'D02.01.rascunho', 2, 'd_plant_b', '/atendimento', 'Salva um rascunho do SOAP',
  format($q$SELECT public.salvar_rascunho_atendimento(%L::uuid, '{"subjetivo":"Cefaleia desde a tarde (rascunho D02)"}'::jsonb)::text$q$, e2e.d_v('d02_ep')));

-- ── 2. entre o fim e o 20º minuto: grava o SOAP ─────────────────────────────
SELECT e2e.d02_fim('D02.02.fim_10', 10);
SELECT e2e.d_passo('D02.02.tolerancia_servidor', 2, 'banco', NULL, 'private.tolerancia_fim_plantao() = 20 min',
  $q$SELECT e2e.d_confere(private.tolerancia_fim_plantao() = interval '20 minutes', private.tolerancia_fim_plantao()::text)$q$);
SELECT e2e.d_dep('d02_ep', 'D02.00.ficha', 'D02.02.soap', 2, 'd_plant_b', '/atendimento', '10 min depois do fim, com check-in: grava o SOAP (CID R51)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Cefaleia desde a tarde (teste D02)', 'PA 150x95 na triagem, sinais crus', 'Cefaleia tensional provável', 'Alta com orientação', 'R51')::text$q$, e2e.d_v('d02_ep')));
SELECT e2e.d_lacuna('D02.03.casca_15_20', 2, 'd_plant_b', 'Casca × servidor: 15 vs 20 min depois do fim',
  'Só na tela. No código, src/lib/offline/regras.ts usa a tolerância do servidor (20 min); só o comentário de src/hooks/usePlantao.ts (l. 40) ainda diz 15 min. A casca relê situacao_checkin a cada 60 s.');

-- ── 4. depois do 20º minuto: fecha, mesmo em uso ────────────────────────────
SELECT e2e.d02_fim('D02.04.fim_21', 21);
SELECT e2e.d_passo('D02.04.porta_fechada', 2, 'd_plant_b', '/atendimento (usePlantao)', '21 min depois do fim: nenhum plantão agora para a plantonista B',
  $q$SELECT e2e.d_confere(NOT EXISTS (SELECT 1 FROM public.meu_plantao_agora()), 'meu_plantao_agora vazio')$q$);
SELECT e2e.d_dep('d02_ep', 'D02.00.ficha', 'D02.04.desfecho_recusado', 2, 'd_plant_b', '/atendimento → AbaDesfecho', 'Tenta registrar a alta depois do 20º minuto (deve ser recusado)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', NULL, '{}'::jsonb)::text$q$, e2e.d_v('d02_ep')), 'erro');

-- ── 5 e 6. liberação do gestor e desfecho ───────────────────────────────────
SELECT e2e.d_passo('D02.05.liberar', 2, 'd_ges', '/escala → PresencasDoDia', 'Gestor libera 30 min: "terminar desfecho de paciente em curso"',
  format($q$SELECT public.liberar_pos_plantao(%L::uuid, %L::uuid, 30, 'terminar desfecho de paciente em curso')::text$q$,
    'fd100000-0000-4000-8000-000000000001', 'fd200000-0000-4000-8000-000000000002'), 'ok', 'd02_lib');
SELECT e2e.d_dep('d02_lib', 'D02.05.liberar', 'D02.05.liberacao', 2, 'banco', NULL, 'Liberação com motivo, autor = gestor e expira_em = concedido + 30 min; auditoria',
  format($q$SELECT e2e.d_confere(l.concedido_por = %L AND l.expira_em = l.concedido_em + interval '30 minutes' AND length(l.motivo) >= 10
      AND EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade_id = l.id AND a.acao = 'liberar_pos_plantao' AND a.ator_id = l.concedido_por),
      'expira ' || to_char(l.expira_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ', motivo ' || l.motivo)
     FROM public.liberacao_pos_plantao l WHERE l.id = %L$q$, 'fd200000-0000-4000-8000-000000000005', e2e.d_v('d02_lib')));
SELECT e2e.d_dep('d02_ep', 'D02.00.ficha', 'D02.06.alta', 2, 'd_plant_b', '/atendimento → AbaDesfecho', 'Dentro da liberação: registra a alta (CID do SOAP)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', NULL, '{}'::jsonb)::text$q$, e2e.d_v('d02_ep')));
SELECT e2e.d_dep('d02_ep', 'D02.00.ficha', 'D02.06.encerrado', 2, 'banco', NULL, 'Episódio com desfecho alta, encerrado na data de Brasília, autor = plantonista B',
  format($q$SELECT e2e.d_confere(desfecho = 'alta' AND encerrado_em IS NOT NULL AND desfecho_por = %L,
      'desfecho ' || coalesce(desfecho, '?') || ' em ' || coalesce(to_char(encerrado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'), '?'))
     FROM public.episodios WHERE id = %L$q$, 'fd200000-0000-4000-8000-000000000002', e2e.d_v('d02_ep')));

-- ── 7. liberação vencida ────────────────────────────────────────────────────
SELECT CASE WHEN e2e.d_v('d02_lib') IS NOT NULL THEN e2e.d_ajuste('D02.07.lib_vence', 2, 'A liberação do cenário vence (concedida há 31 min, expira_em = agora − 1 min)',
  format('UPDATE public.liberacao_pos_plantao SET concedido_em = now() - interval %L, expira_em = now() - interval %L WHERE id = %L', '31 minutes', '1 minute', e2e.d_v('d02_lib'))) END;
SELECT e2e.d_passo('D02.07.fecha_de_novo', 2, 'd_plant_b', '/atendimento', 'Liberação vencida: a porta fecha de novo e a escrita é recusada',
  $q$SELECT e2e.d_confere(NOT EXISTS (SELECT 1 FROM public.meu_plantao_agora()), 'meu_plantao_agora vazio')$q$);
SELECT e2e.d_passo('D02.07.ficha_recusada', 2, 'd_plant_b', '/recepcao', 'Qualquer escrita de porta (abrir ficha) é recusada',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Teste de escrita depois da liberação', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'fd300000-0000-4000-8000-000000000011', jsonb_build_object('nome', 'Teste Escrita D02 ' || e2e.d_v('d02_rodada'), 'data_nascimento', '1990-01-01', 'sexo', 'M')), 'erro:Acesso negado: você não está de plantão');

-- ── 8. faixas da liberação ──────────────────────────────────────────────────
SELECT e2e.d_passo('D02.08.quatro_min', 2, 'd_ges', 'PresencasDoDia', 'Liberar 4 min (deve ser recusado)',
  format($q$SELECT public.liberar_pos_plantao(%L::uuid, %L::uuid, 4, 'terminar desfecho de paciente em curso')::text$q$,
    'fd100000-0000-4000-8000-000000000001', 'fd200000-0000-4000-8000-000000000002'), 'erro:A liberação vale de 5 a 120 minutos');
SELECT e2e.d_passo('D02.08.cento_vinte_um', 2, 'd_ges', 'PresencasDoDia', 'Liberar 121 min (deve ser recusado)',
  format($q$SELECT public.liberar_pos_plantao(%L::uuid, %L::uuid, 121, 'terminar desfecho de paciente em curso')::text$q$,
    'fd100000-0000-4000-8000-000000000001', 'fd200000-0000-4000-8000-000000000002'), 'erro:A liberação vale de 5 a 120 minutos');
SELECT e2e.d_passo('D02.08.motivo_curto', 2, 'd_ges', 'PresencasDoDia', 'Liberar com motivo de 5 letras (deve ser recusado)',
  format($q$SELECT public.liberar_pos_plantao(%L::uuid, %L::uuid, 30, 'curto')::text$q$,
    'fd100000-0000-4000-8000-000000000001', 'fd200000-0000-4000-8000-000000000002'), 'erro:Informe o motivo da liberação');
SELECT e2e.d_passo('D02.08.nenhuma_linha', 2, 'banco', NULL, 'Nenhuma liberação nova gravada pelas três recusas',
  format($q$SELECT e2e.d_confere(count(*) = 1, count(*) || ' liberação(ões) da plantonista B nesta rodada') FROM public.liberacao_pos_plantao
     WHERE perfil_id = %L AND (concedido_em = now() OR id = %L)$q$, 'fd200000-0000-4000-8000-000000000002', coalesce(e2e.d_v('d02_lib'), gen_random_uuid()::text)));

-- ── 9. mais de 12 h depois do fim ───────────────────────────────────────────
SELECT e2e.d02_fim('D02.09.fim_13h', 13 * 60);
SELECT e2e.d_passo('D02.09.liberar_13h', 2, 'd_ges', 'PresencasDoDia', 'Liberar 13 h depois do fim do plantão (o catálogo espera recusa: fora do prazo de 12 h)',
  format($q$SELECT public.liberar_pos_plantao(%L::uuid, %L::uuid, 30, 'liberação fora do prazo de 12 horas')::text$q$,
    'fd100000-0000-4000-8000-000000000001', 'fd200000-0000-4000-8000-000000000002'), 'erro', 'd02_lib_13h');
SELECT e2e.d_passo('D02.09.nao_reabre', 2, 'd_plant_b', '/atendimento', 'Com a liberação gravada, o plantão de 13 h atrás NÃO reabre (o limite de 12 h está em plantoes_agora)',
  $q$SELECT e2e.d_confere(NOT EXISTS (SELECT 1 FROM public.meu_plantao_agora()), 'meu_plantao_agora vazio')$q$);

-- ── bordas ──────────────────────────────────────────────────────────────────
SELECT e2e.d02_fim('D02.B1.fim_em_30', -30);
SELECT CASE WHEN e2e.d_v('d02_pres_b') IS NOT NULL THEN e2e.d_passo('D02.B1.checkout', 2, 'd_plant_b', '/plantao (check-out)', 'Check-out manual 30 min antes do fim',
  format('SELECT public.registrar_checkout(%L::uuid, NULL, NULL)::text', e2e.d_v('d02_pres_b'))) END;
SELECT e2e.d02_fim('D02.B1.fim_5', 5);
SELECT e2e.d_passo('D02.B1.checkout_fecha', 2, 'd_plant_b', '/atendimento', 'Depois do check-out, 5 min após o fim (o catálogo espera: o check-out fecha antes dos 20 min)',
  $q$SELECT e2e.d_confere(NOT EXISTS (SELECT 1 FROM public.meu_plantao_agora()), 'meu_plantao_agora: ' || coalesce((SELECT string_agg(turno || ' ' || setor_nome, ', ') FROM public.meu_plantao_agora()), 'vazio'))$q$);
SELECT e2e.d02_fim('D02.B1.em_curso_depois_checkout', -30);
SELECT e2e.d_passo('D02.B1.checkout_em_curso', 2, 'd_plant_b', '/atendimento', 'Depois do check-out, ainda dentro do horário do plantão: a porta segue aberta?',
  $q$SELECT CASE WHEN EXISTS (SELECT 1 FROM public.meu_plantao_agora()) THEN 'porta ABERTA depois do check-out (o check-in continua valendo)' ELSE 'porta fechada' END$q$);
SELECT e2e.d_passo('D02.B2.duas_liberacoes', 2, 'd_ges', 'PresencasDoDia', 'Duas liberações seguidas (30 e 10 min): a segunda vale pelo próprio prazo',
  format($q$SELECT public.liberar_pos_plantao(%L::uuid, %L::uuid, 10, 'segunda liberação de teste do D02')::text$q$,
    'fd100000-0000-4000-8000-000000000001', 'fd200000-0000-4000-8000-000000000002'), 'ok', 'd02_lib2');
SELECT e2e.d_dep('d02_lib2', 'D02.B2.duas_liberacoes', 'D02.B2.prazo_proprio', 2, 'banco', NULL, 'expira_em da segunda = concedido + 10 min (não soma à primeira)',
  format($q$SELECT e2e.d_confere(expira_em = concedido_em + interval '10 minutes', 'expira ' || to_char(expira_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'))
     FROM public.liberacao_pos_plantao WHERE id = %L$q$, e2e.d_v('d02_lib2')));
SELECT e2e.d_lacuna('D02.B3.cron_checkout', 2, 'd_plant_b', 'Cron checkout-automatico grava checkout_em sem o médico',
  'Não exercitado: depende do cron agendado no horário real; conferir na manhã seguinte em presenca_plantonista.checkout_automatico.');

-- ── fim: liberações vencidas e o início do plantão da plantonista B volta ao do turno
SELECT e2e.d02_vence_liberacoes('D02.99.vence_liberacoes');
SELECT e2e.d_ajuste('D02.99.inicio_volta', 2, 'O início do plantão da plantonista B volta ao do turno',
  format('UPDATE public.escala_plantao SET turno = turno WHERE id = %L', coalesce(e2e.d_v('d02_pl_b'), gen_random_uuid()::text)));

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D02.%' AND em >= now() GROUP BY 1;
