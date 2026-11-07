-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/): fim do cenário A01, rodada 3,
-- depois do ajuste do ambiente (48_rede_fase5_ajuste_a01.sql).
--
-- Continua do estado em que a rodada 2 deixou a "Gestante A01 Teste B" (ids em
-- e2e.vars, prefixo a01_): observação aberta na UPA (box OA-02), regulação nº 94
-- realizada, leito CM-02 reservado no hospital, conta da UPA em conferência.
-- Refaz o que ficou bloqueado pelos P1-1 e P1-2 do EXECUCAO-A01.md, com ids
-- 'A01R.NN.*' (não sobrescrevem a rodada 2):
--   observação (painel, enfermagem, encerramento) → contrarreferência à UBS →
--   porta do hospital (ficha, classificação, atendimento) → internação no leito
--   reservado → admissão, diagnóstico, laudo e AIH → conta da UPA fechada e
--   faturada → custos.
-- Também documenta a pergunta de produto do P1-2: o médico da porta da UPA tenta
-- encerrar a observação da paciente que ele mesmo pôs lá. O resultado é só
-- registrado (a tentativa, se passar, é desfeita para não mudar o cenário).
--
-- Mesmas regras do 50: cada passo roda como a conta do papel, pelas RPCs das
-- telas; nenhuma dose; a cor é da enfermeira de teste; nada se corrige no produto.
-- Rodar antes: 48, 47 e 41. Não é repetível sobre a mesma paciente (encerra a
-- observação dela): para repetir, rodar o 50 de novo e depois este.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- passo só de registro (decisão do RT): roda como o papel, guarda "aceito" ou
-- "recusado" e desfaz o que tiver feito
CREATE OR REPLACE FUNCTION e2e.a01r_registra(p_passo text, p_papel text, p_rota text, p_descricao text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_det text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.conta(p_papel), 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    EXECUTE p_sql;
    PERFORM set_config('role', 'postgres', true);
    RAISE EXCEPTION 'e2e_desfazer';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    v_det := CASE WHEN SQLERRM = 'e2e_desfazer' THEN 'ACEITO (a ação foi desfeita para não mudar o cenário)' ELSE 'RECUSADO: ' || SQLERRM END;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, 1, p_papel, p_rota, p_descricao, 'registrar (decisão do RT)', 'ok', v_det);
  RETURN 'registrado — ' || p_passo || ' — ' || v_det;
END $$;

DO $$ BEGIN
  IF e2e.v('a01_int') IS NULL OR e2e.v('a01_reg') IS NULL OR e2e.v('a01_conta') IS NULL THEN
    RAISE EXCEPTION 'Faltam os ids da rodada 2 do A01 em e2e.vars (rode o 50).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.internacoes WHERE id = e2e.u('a01_int') AND status = 'em_observacao') THEN
    RAISE EXCEPTION 'A observação da % já não está aberta: rode o 50 de novo e depois este.', e2e.v('a01_nome');
  END IF;
END $$;
SELECT e2e.guardar('a01r_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'a01r\_%' AND nome <> 'a01r_inicio';

-- ── 24 (pergunta de produto): o médico da porta encerra a observação? ───────
SELECT e2e.a01r_registra('A01R.24.porta_finaliza', 'f5_med_upa', '/plantao/observacao',
  'Pergunta de produto (P1-2): o médico da porta, que pôs a paciente em observação e não está escalado nela, tenta encerrar a observação',
  format($q$SELECT public.finalizar_observacao(%L::uuid, 'transferencia', 'O15.0', 'Transferida ao Hospital F5 pela regulação (teste A01)', '{"destino":"Hospital Fase 5"}'::jsonb)$q$,
    e2e.u('a01_int')));

-- ── 18 e 19. observação com a equipe escalada ───────────────────────────────
SELECT e2e.passo('A01R.18.painel', 1, 'f5_med_obs', '/plantao/observacao', 'Médico da observação vê a gestante no painel, com prazo',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM public.painel_observacao(%L::uuid) p WHERE p.internacao_id = %L::uuid),
      (SELECT 'box ' || coalesce(p.box, '?') || ', prazo ' || coalesce(p.prazo::text, '?') || ', estado ' || coalesce(p.estado, '?') FROM public.painel_observacao(%L::uuid) p WHERE p.internacao_id = %L::uuid))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a01_int'), 'f5100000-0000-4000-8000-000000000002', e2e.u('a01_int')));
SELECT e2e.passo('A01R.18.atender', 1, 'f5_med_obs', '/plantao/observacao', 'Médico da observação registra o primeiro atendimento no box',
  format('SELECT public.observacao_atender(%L::uuid)::text', e2e.u('a01_int')));
SELECT e2e.passo('A01R.19.sinais', 1, 'f5_enf_obs', '/plantao/observacao', 'Enfermeira da observação registra sinais seriados crus no box',
  e2e.a01_sinais(e2e.u('a01_pacu'), '{"pressao-arterial-sistolica":154,"pressao-arterial-diastolica":100,"frequencia-respiratoria":18}', e2e.u('a01_int')));
SELECT e2e.passo('A01R.19.sae', 1, 'f5_enf_obs', '/enfermagem', 'SAE da gestante em observação',
  format('SELECT public.registrar_sae(%L::uuid, %L, %L::jsonb, %L::jsonb, %L::jsonb, %L, NULL, %L::uuid)::text', e2e.u('a01_pacu'),
    'Gestante de 33 semanas após crise convulsiva (teste A01)', '[{"titulo":"Risco de lesão"}]', '[{"titulo":"Monitorar sinais e diurese"}]',
    '[{"titulo":"Cuidados conforme prescrição"}]', 'Evolução de teste A01', e2e.u('a01_int')));
SELECT e2e.passo('A01R.19.balanco', 1, 'f5_enf_obs', '/enfermagem', 'Balanço: diurese (valor cru)',
  format('SELECT public.lancar_balanco(%L::uuid, %L, %L, %s, NULL, NULL, %L::uuid)::text', e2e.u('a01_pacu'), 'saida', 'Diurese', 70, e2e.u('a01_int')));
SELECT e2e.passo('A01R.19.porta_ativa', 1, 'f5_med_obs', '/plantao/observacao (Vindos da porta)', 'A prescrição da porta aparece para quem cuida da observação',
  format($q$SELECT e2e.confere(count(*) >= 1, count(*) || ' itens: ' || string_agg(descricao || ' [' || coalesce(posologia, '') || ', validação ' || coalesce(validacao, 'nenhuma') || ']', '; '))
    FROM public.prescricao_porta_ativa(%L::uuid)$q$, e2e.u('a01_pacu')));

-- ── 24. encerramento da observação e contrarreferência ──────────────────────
SELECT e2e.passo('A01R.24.finalizar', 1, 'f5_med_obs', '/plantao/observacao', 'Médico da observação encerra: transferência, CID O15.0 e relato',
  format($q$SELECT public.finalizar_observacao(%L::uuid, 'transferencia', 'O15.0', 'Transferida ao Hospital F5 pela regulação nº 94 (teste A01)', '{"destino":"Hospital Fase 5"}'::jsonb)::text$q$,
    e2e.u('a01_int')), 'ok', 'a01r_finalizada');
SELECT e2e.a01('a01r_finalizada', 'A01R.24.finalizar', 'A01R.24.encerrado', 'banco', NULL, 'Episódio da UPA encerrado, internação de observação com alta e box liberado',
  format($q$SELECT e2e.confere(e.etapa = 'encerrado' AND i.data_alta IS NOT NULL,
      'episódio ' || e.etapa || ', internação ' || i.status || ', box ' || coalesce((SELECT string_agg(DISTINCT l.identificador || ' ' || l.status, ', ')
        FROM public.eventos_leito ev JOIN public.leitos l ON l.id = ev.leito_id WHERE ev.internacao_id = i.id), '?'))
    FROM public.internacoes i JOIN public.episodios e ON e.id = i.episodio_id WHERE i.id = %L$q$, e2e.u('a01_int')));
SELECT e2e.a01('a01r_finalizada', 'A01R.24.finalizar', 'A01R.24.contrarreferencia', 'f5_med_ubs', '/encaminhados?aba=retornos', 'A contrarreferência chega à UBS como a_ver',
  format($q$SELECT coalesce((SELECT r ->> 'id' FROM jsonb_array_elements(public.contrarreferencias_da_unidade(%L::uuid, 7)) r
      WHERE r -> 'paciente' ->> 'nome' = %L LIMIT 1), e2e.falhar('sem contrarreferência para a gestante'))$q$,
    'f5100000-0000-4000-8000-000000000001', e2e.v('a01_nome')), 'ok', 'a01r_ret');
SELECT e2e.a01('a01r_ret', 'A01R.24.contrarreferencia', 'A01R.24.a_ver', 'banco', NULL, 'Contrarreferência a_ver, ligada ao envio e à UBS',
  format($q$SELECT e2e.confere(situacao = 'a_ver' AND unidade_ubs_id = 'f5100000-0000-4000-8000-000000000001',
      'situação ' || situacao || ', desfecho ' || coalesce(desfecho, '?') || ', envio ' || coalesce(encaminhamento_upa_id::text, 'nenhum')) FROM public.contrarreferencias WHERE id = %L$q$, e2e.u('a01r_ret')));

-- ── 29. a UBS abre a contrarreferência ──────────────────────────────────────
SELECT e2e.a01('a01r_ret', 'A01R.24.contrarreferencia', 'A01R.29.recepcao_sem_resumo', 'f5_rec_ubs', '/encaminhados', 'Recepção não abre o resumo (deve ser recusado)',
  format('SELECT public.contrarreferencia_abrir(%L::uuid)::text', e2e.u('a01r_ret')), 'erro');
SELECT e2e.a01('a01r_ret', 'A01R.24.contrarreferencia', 'A01R.29.abrir', 'f5_enf_ubs', '/encaminhados (Retornos)', 'Enfermeira da UBS abre a contrarreferência',
  format('SELECT left(public.contrarreferencia_abrir(%L::uuid)::text, 300)', e2e.u('a01r_ret')));
SELECT e2e.a01('a01r_ret', 'A01R.24.contrarreferencia', 'A01R.29.visto', 'banco', NULL, 'a_ver → visto, com autor = login',
  format($q$SELECT e2e.confere(situacao = 'visto' AND visto_por = 'f5200000-0000-4000-8000-000000000002', 'situação ' || situacao || ', visto por ' || coalesce(right(visto_por::text, 2), '?'))
    FROM public.contrarreferencias WHERE id = %L$q$, e2e.u('a01r_ret')));
SELECT e2e.passo('A01R.29.pre_natal_segue', 1, 'f5_med_ubs', '/pre-natal', 'O pré-natal continua até o desfecho da gestação',
  format($q$SELECT e2e.confere(coalesce(public.pre_natal_do_paciente(%L::uuid) -> 'gestacao', 'null'::jsonb) <> 'null'::jsonb, 'gestação ativa')$q$, e2e.u('a01_pac')));

-- ── 26. hospital: porta, classificação, atendimento e internação ────────────
SELECT e2e.passo('A01R.26.ficha', 1, 'f5_rec_hosp', '/recepcao (Porta do Hospital)', 'Recepção do hospital abre a ficha da gestante regulada na porta',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Gestante transferida pela regulação nº 94 (eclâmpsia)', NULL, %L::jsonb, '{gestante}') ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000024', e2e.v('a01_cadastro')), 'ok', 'a01r_eph');
SELECT e2e.a01('a01r_eph', 'A01R.26.ficha', 'A01R.26.paciente', 'banco', NULL, 'Paciente do hospital',
  format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a01r_eph')), 'ok', 'a01r_pach');
SELECT e2e.a01('a01r_eph', 'A01R.26.ficha', 'A01R.26.classificar', 'f5_enf_hosp', '/triagem (Porta do Hospital)',
  'Enfermeira do hospital classifica vermelho (escolha da enfermeira de teste), sinais crus, bloco de gestação',
  format($q$SELECT public.classificar_risco(%L::uuid, 'vermelho',
    '{"frequencia-cardiaca":102,"frequencia-respiratoria":20,"temperatura":36.8,"saturacao-o2":96,"escala-dor":5,"pressao-arterial-sistolica":158,"pressao-arterial-diastolica":104}'::jsonb,
    (SELECT f.id FROM public.protocolo_fluxogramas f JOIN public.unidades u ON u.protocolo_classificacao_id = f.protocolo_id
      WHERE u.id = %L AND f.nome = 'Convulsão' AND f.publico = 'adulto'),
    'Gestante transferida após eclâmpsia, sob sulfato de magnésio', '{}'::jsonb, NULL, NULL, NULL, NULL, false, true, NULL, NULL, %L::jsonb)::text$q$,
    e2e.u('a01r_eph'), 'f5100000-0000-4000-8000-000000000003',
    jsonb_build_object('tipo', 'gestacao_unica', 'g', 2, 'p', 1, 'a', 0, 'dum', e2e.v('a01_dum'), 'intercorrencias', true,
                       'intercorrencias_texto', 'Eclâmpsia na UPA F5 hoje')));
SELECT e2e.a01('a01r_eph', 'A01R.26.ficha', 'A01R.26.iniciar', 'f5_med_porta_hosp', '/atendimento (Porta do Hospital)', 'Médico da porta assume',
  format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a01r_eph')));
SELECT e2e.a01('a01r_eph', 'A01R.26.ficha', 'A01R.26.soap', 'f5_med_porta_hosp', '/atendimento', 'SOAP de chegada (O15.0)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Transferida da UPA F5 após eclâmpsia (teste A01)', 'PA 158x104, sem nova crise', 'Eclâmpsia', 'Internação', 'O15.0')::text$q$, e2e.u('a01r_eph')));
SELECT e2e.a01('a01r_pach', 'A01R.26.paciente', 'A01R.26.leitos', 'f5_med_porta_hosp', '/atendimento (Desfecho)', 'leitos_para_ocupar oferece o leito CM reservado pela regulação',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM public.leitos_para_ocupar(%L::uuid, %L::uuid) l WHERE l.id = %L::uuid),
      coalesce((SELECT string_agg(identificador || CASE WHEN reservado THEN ' (reservado)' ELSE '' END, ', ') FROM public.leitos_para_ocupar(%L::uuid, %L::uuid)), 'nenhum leito'))$q$,
    'f5300000-0000-4000-8000-000000000021', e2e.u('a01r_pach'), e2e.u('a01_leito_cm'), 'f5300000-0000-4000-8000-000000000021', e2e.u('a01r_pach')));
SELECT e2e.a01('a01r_eph', 'A01R.26.ficha', 'A01R.26.internar', 'f5_med_porta_hosp', '/atendimento (Desfecho)', 'Interna no leito CM reservado pela regulação',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', NULL, jsonb_build_object('setor_id', %L, 'leito_id', %L))::text$q$,
    e2e.u('a01r_eph'), 'f5300000-0000-4000-8000-000000000021', e2e.v('a01_leito_cm')));
SELECT e2e.a01('a01r_eph', 'A01R.26.ficha', 'A01R.26.internacao', 'banco', NULL, 'Internação no hospital',
  format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L AND etapa = 'internacao'$q$, e2e.u('a01r_eph')), 'ok', 'a01r_inth');
SELECT e2e.a01('a01r_inth', 'A01R.26.internacao', 'A01R.26.leito_e_reserva', 'banco', NULL, 'Leito ocupado e o que acontece com a reserva da regulação',
  format($q$SELECT e2e.confere(l.status = 'ocupado', 'leito ' || l.identificador || ' ' || l.status || '; reserva ' || coalesce(r.situacao, '?') || coalesce(' (' || r.motivo_encerramento || ')', '')
      || '; internação da reserva ' || coalesce(r.internacao_id::text, 'nenhuma'))
    FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id
    LEFT JOIN public.reservas_leito r ON r.id = (SELECT reserva_id FROM public.regulacao_solicitacoes WHERE id = %L)
   WHERE i.id = %L$q$, e2e.u('a01_reg'), e2e.u('a01r_inth')));

-- ── 27 e 28. admissão, diagnóstico, laudo e AIH ─────────────────────────────
SELECT e2e.a01('a01r_inth', 'A01R.26.internacao', 'A01R.27.admissao', 'f5_med_hosp', '/plantao/internacao (caderno do leito)', 'Médico da Clínica Médica registra a admissão',
  format($q$SELECT public.registrar_admissao(%L::uuid, 'Admissão de gestante de 33 semanas com eclâmpsia, transferida da UPA F5 (teste A01)',
    '{"subjetivo":"Crise convulsiva na UPA F5, transferida pela regulação (teste A01)","objetivo":"PA 158x104 na chegada, sem nova crise","cid":"O15.0","plano":"Conduta conforme a ficha adulto-emergencia-hipertensiva (teste de fluxo)"}'::jsonb)::text$q$, e2e.u('a01r_inth')));
SELECT e2e.a01('a01r_inth', 'A01R.26.internacao', 'A01R.27.diagnostico', 'f5_med_hosp', '/plantao/internacao', 'Diagnóstico primário confirmado O15.0',
  format($q$SELECT public.registrar_diagnostico(%L::uuid, 'primario', 'O15.0', 'confirmado', NULL, NULL, NULL)::text$q$, e2e.u('a01r_inth')));
SELECT e2e.a01('a01r_inth', 'A01R.26.internacao', 'A01R.27.laudo_aih', 'f5_med_hosp', '/plantao/internacao (laudo AIH)', 'Emite o laudo de AIH com o procedimento principal 0303100028',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'laudo_aih', %L) ->> 'id')$q$, e2e.u('a01r_pach'),
    jsonb_build_object('aih', jsonb_build_object('sinais', 'Crise convulsiva na UPA, PA elevada (teste A01)', 'condicoes', 'Eclâmpsia em gestante de 33 semanas',
      'diagnostico', 'Eclâmpsia', 'cid', 'O15.0', 'procCod', '0303100028', 'procDesc', 'TRATAMENTO DE ECLAMPSIA', 'clinica', 'Obstétrica'))::text), 'ok', 'a01r_laudo');
SELECT e2e.a01('a01r_laudo', 'A01R.27.laudo_aih', 'A01R.27.aih', 'banco', NULL, 'AIH solicitada pelo gatilho do laudo',
  format($q$SELECT a.id::text FROM public.aihs a WHERE a.laudo_id = %L AND a.status = 'solicitada'$q$, e2e.u('a01r_laudo')), 'ok', 'a01r_aih');
SELECT e2e.a01('a01r_aih', 'A01R.27.aih', 'A01R.28.conferir', 'f5_regulador', '/aih', 'Regulador confere o procedimento com o CID (sigtap_procedimento_cid), como o catálogo pede',
  format($q$SELECT left(public.conferir_aih(%L::uuid, 'O15.0', NULL, NULL, '0303100028')::text, 300)$q$, e2e.u('a01r_pach')));
SELECT e2e.a01('a01r_aih', 'A01R.27.aih', 'A01R.28.conferir_medico', 'f5_med_hosp', '/plantao/internacao (laudo AIH)', 'O médico da internação confere o procedimento com o CID',
  format($q$SELECT left(public.conferir_aih(%L::uuid, 'O15.0', NULL, NULL, '0303100028')::text, 300)$q$, e2e.u('a01r_pach')));
SELECT e2e.a01('a01r_aih', 'A01R.27.aih', 'A01R.28.fat_nao_decide', 'f5_fat', '/aih', 'Faturamento tenta decidir a AIH (deve ser recusado)',
  format($q$SELECT public.decidir_aih(%L::uuid, true, '3526100094001', %L, NULL)::text$q$, e2e.u('a01r_aih'), to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')), 'erro');
SELECT e2e.a01('a01r_aih', 'A01R.27.aih', 'A01R.28.decidir', 'f5_regulador', '/aih', 'Regulador aprova a AIH',
  format($q$SELECT public.decidir_aih(%L::uuid, true, '3526100094001', %L, NULL)::text$q$, e2e.u('a01r_aih'), to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')), 'ok', 'a01r_aih_ok');
SELECT e2e.a01('a01r_aih_ok', 'A01R.28.decidir', 'A01R.28.aprovada', 'banco', NULL, 'AIH aprovada com número e competência, evento gravado',
  format($q$SELECT e2e.confere(status = 'aprovada', 'status ' || status || ', número ' || coalesce(numero, '?') || ', competência ' || coalesce(competencia, '?')
      || ', eventos ' || (SELECT count(*) FROM public.aih_eventos WHERE aih_id = a.id)) FROM public.aihs a WHERE id = %L$q$, e2e.u('a01r_aih')));

-- ── contas do hospital ──────────────────────────────────────────────────────
SELECT e2e.a01('a01r_inth', 'A01R.26.internacao', 'A01R.27.conta_internacao', 'f5_fat', '/faturamento/contas (Hospital)', 'Conta de internação aberta no hospital',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'internacao' LIMIT 1), e2e.falhar('conta de internação não achada'))$q$,
    'f5100000-0000-4000-8000-000000000003', e2e.v('a01_nome')), 'ok', 'a01r_conta_int');
SELECT e2e.a01('a01r_conta_int', 'A01R.27.conta_internacao', 'A01R.27.conta_aih', 'f5_fat', '/faturamento/contas (Hospital)', 'O procedimento principal da AIH (SH + SP) entra na conta da internação',
  format($q$SELECT e2e.confere((d -> 'itens')::text LIKE '%%0303100028%%', 'total ' || (d ->> 'total_referencia') || '; ' || left((d -> 'itens')::text, 250))
    FROM (SELECT public.conta_detalhe(%L::uuid) d) x$q$, e2e.u('a01r_conta_int')));
SELECT e2e.a01('a01r_eph', 'A01R.26.ficha', 'A01R.26.conta_porta_hospital', 'f5_fat', '/faturamento/contas (Hospital)', 'Conta da porta do hospital (classificação e consulta)',
  format($q$SELECT coalesce((SELECT (c ->> 'id') || ' — total ' || (public.conta_detalhe((c ->> 'id')::uuid) ->> 'total_referencia')
      FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' LIMIT 1), e2e.falhar('conta da porta do hospital não achada'))$q$,
    'f5100000-0000-4000-8000-000000000003', e2e.v('a01_nome')));

-- ── 30 e 31. conta da UPA: fechar e faturar ─────────────────────────────────
SELECT e2e.passo('A01R.30.detalhe', 1, 'f5_fat', '/faturamento/contas', 'Pré-auditoria da conta da UPA depois do desfecho',
  format($q$SELECT 'status ' || (d ->> 'status') || '; total ' || (d ->> 'total_referencia') || '; itens ' || jsonb_array_length(d -> 'itens')
      || '; pendências ' || jsonb_array_length(d -> 'pendencias') || '; bloqueantes sem liberação ' || (d ->> 'bloqueantes_sem_liberacao')
    FROM (SELECT public.conta_detalhe(%L::uuid) d) x$q$, e2e.u('a01_conta')));
SELECT e2e.a01('a01r_finalizada', 'A01R.24.finalizar', 'A01R.31.fechar', 'f5_fat', '/faturamento/contas', 'Faturamento fecha a conta da UPA',
  format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('a01_conta'), 'fechada'), 'ok', 'a01r_fechada');
SELECT CASE WHEN e2e.v('a01r_finalizada') IS NULL THEN e2e.lacuna('A01R.31.liberar', 1, 'f5_ges_upa', 'Gestor libera o fechamento', 'bloqueado pelo passo A01R.24.finalizar')
            WHEN e2e.v('a01r_fechada') IS NOT NULL THEN e2e.lacuna('A01R.31.liberar', 1, 'f5_ges_upa', 'Gestor libera o fechamento', 'não precisou: a conta fechou sem pendência bloqueante')
  ELSE e2e.passo('A01R.31.liberar', 1, 'f5_ges_upa', '/faturamento/contas', 'Gestor libera o fechamento com motivo',
    format($q$SELECT left(public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo A01: pendências conhecidas da rede de teste')::text, 300)$q$, e2e.u('a01_conta'))) END;
SELECT CASE WHEN e2e.v('a01r_finalizada') IS NULL OR e2e.v('a01r_fechada') IS NOT NULL THEN 'fechar: já fechada ou bloqueada'
  ELSE e2e.passo('A01R.31.fechar_liberada', 1, 'f5_fat', '/faturamento/contas', 'Faturamento fecha a conta liberada',
    format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('a01_conta'), 'fechada'), 'ok', 'a01r_fechada') END;
SELECT e2e.a01('a01r_fechada', 'A01R.31.fechar', 'A01R.31.total_congelado', 'banco', NULL, 'O total congelado no fechamento é o calculado antes',
  format($q$SELECT e2e.confere((SELECT coalesce(sum((x ->> 'valor_total')::numeric), 0) FROM jsonb_array_elements(c.itens_congelados) x) = 12.26,
      'congelados ' || jsonb_array_length(c.itens_congelados) || ', total ' || (SELECT coalesce(sum((x ->> 'valor_total')::numeric), 0) FROM jsonb_array_elements(c.itens_congelados) x))
    FROM public.contas c WHERE c.id = %L$q$, e2e.u('a01_conta')));
SELECT e2e.a01('a01r_fechada', 'A01R.31.fechar', 'A01R.31.faturar', 'f5_fat', '/faturamento/contas', 'fechada → faturada',
  format('SELECT public.mudar_etapa_conta(%L::uuid, %L, NULL)::text', e2e.u('a01_conta'), 'faturada'), 'ok', 'a01r_faturada');
SELECT e2e.a01('a01r_faturada', 'A01R.31.faturar', 'A01R.31.erp', 'banco', NULL, 'Versão da conta para o ERP',
  format($q$SELECT e2e.confere(count(*) >= 1, string_agg('versão ' || versao || ', total ' || total || ', ' || situacao || ', conciliação ' || conciliacao, '; '))
    FROM public.conta_versoes_erp WHERE conta_id = %L$q$, e2e.u('a01_conta')));
SELECT e2e.a01('a01r_faturada', 'A01R.31.faturar', 'A01R.31.fat_nao_reabre', 'f5_fat', '/faturamento/contas', 'Faturamento não reabre conta faturada (deve ser recusado)',
  format($q$SELECT public.mudar_etapa_conta(%L::uuid, 'aberta', 'Teste de permissão do faturamento')::text$q$, e2e.u('a01_conta')), 'erro:Reabrir conta fechada é do gestor');

-- ── 32. BPA de novo (a conta faturada não muda as linhas) ───────────────────
SELECT e2e.passo('A01R.32.bpa_upa', 1, 'f5_fat', '/faturamento (BPA)', 'Três linhas BPA-I da gestante na UPA, sem crítica',
  format($q$SELECT e2e.confere(count(*) = 3, string_agg((x ->> 'origem') || ' ' || (x ->> 'procedimento') || ' qt ' || (x ->> 'quantidade') || ' críticas ' || (x -> 'criticas')::text, '; '))
    FROM jsonb_array_elements(public.bpa_conferencia(%L::uuid, %L) -> 'linhas') x WHERE x ->> 'paciente' = %L$q$,
    'f5100000-0000-4000-8000-000000000002', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), e2e.v('a01_nome')));

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'A01R.%' AND em >= e2e.v('a01r_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
