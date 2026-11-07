-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário A02, parte 2.
-- Roda DEPOIS do 52 e depois de uma volta do cron real "encaminhamento-upa-prazo"
-- (*/15). Continua da paciente da última rodada do 52 (ids a02_* em e2e.vars):
-- o envio com o prazo antecipado já deve estar nao_chegou.
--   8. o cron marcou nao_chegou → 9. a UBS vê → 12. cancelar nao_chegou
--   (borda) → 10. Marta aparece na UPA 14 h depois: a recepção acha o envio,
--   abre a ficha e marca "Chegou" → 11. "Chegou" sem ficha (só registro).
-- Os apoios e2e.ba* vêm do 52 (rodar o 52 antes, na mesma base).
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/52b_cenario_a02_prazo.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DO $$ BEGIN
  IF e2e.v('a02_env') IS NULL THEN RAISE EXCEPTION 'Falta o envio da parte 1 (a02_env): rode o 52.'; END IF;
END $$;
SELECT e2e.guardar('a02b_inicio', now()::text);

-- ── 8. o cron marcou nao_chegou ─────────────────────────────────────────────
SELECT e2e.ba(2, 'a02_env', 'A02.06.enviar', 'A02.08.nao_chegou', 'banco', NULL, 'O cron real marcou o envio como nao_chegou, sem ação da UBS',
  format($q$SELECT e2e.confere(x.situacao = 'nao_chegou' AND x.chegada_por IS NULL,
      'situação ' || x.situacao || ', observação "' || coalesce(x.observacao_chegada, '') || '", prazo ' || x.prazo_em
      || ', última volta do cron ' || coalesce((SELECT max(d.end_time)::text FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
                                               WHERE j.jobname = 'encaminhamento-upa-prazo' AND d.status = 'succeeded'), '?'))
    FROM public.encaminhamentos_upa x WHERE x.id = %L$q$, e2e.v('a02_env')));
SELECT e2e.ba(2, 'a02_env', 'A02.06.enviar', 'A02.08.aviso', 'banco', NULL, 'Aviso do nao_chegou para a UBS (notificação)',
  format($q$SELECT e2e.confere(count(*) >= 1, count(*) || ' aviso(s): ' || coalesce(string_agg(DISTINCT left(n.mensagem, 120), ' | '), ''))
    FROM public.notificacoes_plantonista n WHERE n.unidade_id = 'f5100000-0000-4000-8000-000000000001' AND n.mensagem LIKE %L$q$,
    '%' || e2e.v('a02_nome') || '%não registrou a chegada%'));

-- ── 9. a UBS vê o não comparecimento ────────────────────────────────────────
SELECT e2e.ba(2, 'a02_env', 'A02.06.enviar', 'A02.09.encaminhados', 'f5_med_ubs', '/encaminhados', 'Médica da UBS vê nao_chegou no painel',
  format($q$SELECT e2e.confere(e ->> 'situacao' = 'nao_chegou', 'situação ' || coalesce(e ->> 'situacao', '?'))
    FROM jsonb_array_elements(public.encaminhamentos_upa_origem(%L::uuid, 7)) e WHERE (e ->> 'id')::uuid = %L::uuid$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.u('a02_env')));
SELECT e2e.lacuna('A02.09.busca_ativa', 2, 'f5_med_ubs', 'Registro de busca ativa / visita do ACS',
  'Lacuna (MAPA): ACS, busca ativa e visita domiciliar não existem; o não comparecimento fica só como nao_chegou.');

-- ── 12. borda: cancelar um envio já nao_chegou ──────────────────────────────
SELECT e2e.ba(2, 'a02_env', 'A02.06.enviar', 'A02.12.cancelar_nao_chegou', 'f5_enf_ubs', '/encaminhados', 'Enfermeira (quem enviou) tenta cancelar o envio nao_chegou (deve ser recusado)',
  format($q$SELECT public.encaminhamento_upa_cancelar(%L::uuid, 'Paciente não foi à UPA (teste A02)')::text$q$, e2e.u('a02_env')),
  'erro:Só se cancela o envio que ainda espera a chegada');

-- ── 10 e 11. Marta aparece na UPA 14 h depois ───────────────────────────────
SELECT e2e.ba(2, 'a02_env', 'A02.06.enviar', 'A02.10.vindo', 'f5_rec_upa', '/recepcao → VindoDaUbs', 'A recepção da UPA ainda acha o envio nao_chegou (enviado há menos de 1 dia)',
  format($q$SELECT e2e.confere(e ->> 'situacao' = 'nao_chegou', 'situação ' || coalesce(e ->> 'situacao', '?') || ', nº ' || coalesce(e ->> 'numero', '?'))
    FROM jsonb_array_elements(public.encaminhamentos_upa_destino(%L::uuid)) e WHERE (e ->> 'id')::uuid = %L::uuid$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a02_env')));
SELECT e2e.ba_registra(2, 'A02.11.chegou_sem_ficha', 'f5_rec_upa', '/recepcao → VindoDaUbs',
  'Borda (PR #438): "Chegou" sem ficha aberta. A tela não deve permitir; aqui se registra o que o servidor faz (e desfaz)',
  CASE WHEN e2e.v('a02_env') IS NULL THEN NULL ELSE format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, NULL)', e2e.v('a02_env')) END);
SELECT e2e.ba_passo('A02.10.ficha', 2, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Recepção da UPA abre a ficha de Marta no Pronto Socorro (prioridade gestante)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor de cabeça e pressão alta (enviada pela UBS ontem)', NULL, %L::jsonb, '{gestante}') ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('a02_cadastro')), 'ok', 'a02_epu');
SELECT e2e.ba(2, 'a02_epu', 'A02.10.ficha', 'A02.10.paciente', 'banco', NULL, 'Paciente da UPA',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a02_epu')), 'ok', 'a02_pacu');
SELECT e2e.ba(2, 'a02_epu,a02_env', 'A02.10.ficha', 'A02.10.chegou', 'f5_rec_upa', '/recepcao → VindoDaUbs', 'Marca "Chegou" com a ficha escolhida: o nao_chegou automático vira chegou',
  format('SELECT public.encaminhamento_upa_marcar_chegada(%L::uuid, true, %L::uuid)::text', e2e.u('a02_env'), e2e.u('a02_epu')));
SELECT e2e.ba(2, 'a02_epu,a02_env', 'A02.10.ficha', 'A02.10.ligado', 'banco', NULL, 'O envio fica chegou, ligado à ficha da UPA',
  format($q$SELECT e2e.confere(situacao = 'chegou' AND episodio_destino_id = %L, 'situação ' || situacao || ', ficha ' || coalesce(episodio_destino_id::text, 'nenhuma'))
    FROM public.encaminhamentos_upa WHERE id = %L$q$, e2e.v('a02_epu'), e2e.v('a02_env')));
SELECT e2e.ba(2, 'a02_env', 'A02.06.enviar', 'A02.10.ubs_ve_chegou', 'f5_ges_ubs', '/encaminhados', 'A UBS passa a ver chegou',
  format($q$SELECT e2e.confere(e ->> 'situacao' = 'chegou', 'situação ' || coalesce(e ->> 'situacao', '?'))
    FROM jsonb_array_elements(public.encaminhamentos_upa_origem(%L::uuid, 7)) e WHERE (e ->> 'id')::uuid = %L::uuid$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.u('a02_env')));
SELECT e2e.ba(2, 'a02_epu', 'A02.10.ficha', 'A02.10.conta', 'f5_fat', '/faturamento/contas', 'Conta ambulatorial aberta na UPA, sem itens (R$ 0,00)',
  format($q$SELECT coalesce((SELECT (c ->> 'id') || ' — itens ' || jsonb_array_length(public.conta_detalhe((c ->> 'id')::uuid) -> 'itens')
                            || ', total ' || coalesce(public.conta_detalhe((c ->> 'id')::uuid) ->> 'total_referencia', 'nulo')
      FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' AND c ->> 'status' = 'aberta' LIMIT 1), e2e.falhar('conta aberta não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a02_nome')));
SELECT e2e.ba(2, 'a02_pac', 'A02.00.paciente', 'A02.99.ubs_sem_valor', 'f5_ges_ubs', '/faturamento', 'A UBS não gera item com valor nem linha de BPA para Marta',
  format($q$SELECT e2e.confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND jsonb_array_length(public.conta_detalhe((c ->> 'id')::uuid) -> 'itens') > 0)
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.bpa_conferencia(%L::uuid, %L) -> 'linhas') x WHERE x ->> 'paciente' = %L),
      'UBS sem item com valor e sem BPA; contas da UBS de Marta: ' || (SELECT count(*) FROM public.contas k JOIN public.pacientes p ON p.id = k.paciente_id
                                                                      WHERE p.id = %L))$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.v('a02_nome'), 'f5100000-0000-4000-8000-000000000001',
    to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), e2e.v('a02_nome'), e2e.v('a02_pac')));

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'A02.%' AND em >= e2e.v('a02b_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
