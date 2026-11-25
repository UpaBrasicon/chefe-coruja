-- ════════════════════════════════════════════════════════════════════════════
-- Teste de fluxo B, fase 3: observação que vira internação, admissão, diagnóstico,
-- isolamento no atendimento e a aba Exames do leito (cesta com observação do
-- pedido, indicação e CID; impressão; planilha; "alterado"; cancelar).
-- B10 fica na observação (pede a vaga de lá).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE TEMP TABLE _r (o serial, txt text) ON COMMIT DROP;

-- observação: atendimento no box e conversão em internação (B05 e B06)
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.5.obs_atender', 'med', 'Médico registra o atendimento no box da observação',
  format('SELECT public.observacao_atender(%L::uuid)::text', e2e.fbu(c.n, 'int')), 'ok', NULL, false, 'int')
  FROM e2e.fb_coorte c WHERE c.via = 'observacao' ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.5.obs_enfermeiro_nao_finaliza', 'enf', 'Enfermeiro tenta encerrar a observação com internação: deve recusar',
  format($q$SELECT public.finalizar_observacao(%L::uuid, 'internacao', %L, 'Teste de fluxo', %L::jsonb)::text$q$, e2e.fbu(c.n, 'int'), c.cid,
    jsonb_build_object('setor_id', c.setor, 'leito_id', (SELECT l.id FROM public.leitos l WHERE l.setor_id = c.setor AND l.identificador = c.leito))), 'erro', NULL, false, 'int')
  FROM e2e.fb_coorte c WHERE c.n = 5;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.5.obs_internar', 'med', 'Observação vira internação no leito ' || c.leito,
  format($q$SELECT public.finalizar_observacao(%L::uuid, 'internacao', %L, %L, %L::jsonb)::text || 'internado'$q$, e2e.fbu(c.n, 'int'), c.cid,
    c.hipotese || ': mantém indicação de internação (teste de fluxo)',
    jsonb_build_object('setor_id', c.setor, 'leito_id', (SELECT l.id FROM public.leitos l WHERE l.setor_id = c.setor AND l.identificador = c.leito))), 'ok', 'obs_internado', false, 'int')
  FROM e2e.fb_coorte c WHERE c.via = 'observacao' AND c.leito IS NOT NULL ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.5.obs_leito', 'banco', 'A mesma internação, agora no leito; o box da observação ficou livre ou em higienização',
  format($q$SELECT e2e.fb_confere(i.status = 'internado' AND l.identificador = %L AND l.status = 'ocupado',
      i.status || ' em ' || coalesce(l.identificador, '-') || '; boxes OBS: ' || (SELECT string_agg(x.identificador || '=' || x.status, ', ' ORDER BY x.identificador) FROM public.leitos x WHERE x.setor_id = '32000000-0000-4000-8000-000000000002'))
    FROM public.internacoes i LEFT JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = %L$q$, c.leito, e2e.fbu(c.n, 'int')), 'ok', NULL, false, 'obs_internado')
  FROM e2e.fb_coorte c WHERE c.via = 'observacao' AND c.leito IS NOT NULL ORDER BY c.n;

-- admissão e diagnóstico no leito
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.5.admissao', 'med', 'Admissão no leito (ficha)',
  format($q$SELECT public.registrar_admissao(%L::uuid, %L, %L::jsonb)::text$q$, e2e.fbu(c.n, 'int'),
    'Admissão: ' || c.quadro, jsonb_build_object('subjetivo', c.queixa, 'objetivo', 'Sinais vitais da triagem conferidos (teste de fluxo)', 'cid', c.cid, 'plano', 'Exames, medicação conforme a ficha e pedido de vaga pela regulação (teste de fluxo)')),
  'ok', 'adm', false, 'int')
  FROM e2e.fb_coorte c WHERE c.leito IS NOT NULL ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.5.diagnostico', 'med', 'Diagnóstico primário ' || c.cid,
  format($q$SELECT public.registrar_diagnostico(%L::uuid, 'primario', %L, 'confirmado', NULL, NULL, NULL)::text$q$, e2e.fbu(c.n, 'int'), c.cid), 'ok', 'diag', false, 'int')
  FROM e2e.fb_coorte c WHERE c.leito IS NOT NULL ORDER BY c.n;

-- isolamento marcado no atendimento (contato, gotícula, aerossol)
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.5.isolamento_tecnico', 'tec', 'Técnico de enfermagem marca isolamento (registro do que o servidor faz; desfeito)',
  format('SELECT public.marcar_isolamento(%L::uuid, %L, %L)::text', e2e.fbu(c.n, 'pac'), c.iso_pac, c.iso_agente), 'registrar', NULL, true, 'int')
  FROM e2e.fb_coorte c WHERE c.n = 2;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.5.isolamento', CASE WHEN c.n = 8 THEN 'enf' ELSE 'med' END, 'Marca isolamento por ' || c.iso_pac || ' no atendimento',
  format('SELECT public.marcar_isolamento(%L::uuid, %L, %L)::text', e2e.fbu(c.n, 'pac'), c.iso_pac, c.iso_agente), 'ok', 'iso', false, 'int')
  FROM e2e.fb_coorte c WHERE c.iso_pac IS NOT NULL ORDER BY c.n;

-- ── aba Exames do leito ─────────────────────────────────────────────────────
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.exames_nir_nao_pede', x.papel, 'Outro perfil (' || x.papel || ') tenta pedir exames no leito: deve recusar',
  format($q$SELECT public.pedir_exames_internacao(%L::uuid, '[{"procedimento":"0202010317"}]'::jsonb, 'laboratorio', 'rotina', NULL)::text$q$, e2e.fbu(c.n, 'int')),
  'erro:o pedido de exames é do médico', NULL, false, 'int')
  FROM e2e.fb_coorte c CROSS JOIN (VALUES ('nir'), ('enf'), ('ges')) x(papel) WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.exames_lab', 'med', 'Cesta de laboratório com observação do pedido, indicação e CID',
  format($q$SELECT public.pedir_exames_internacao(p_internacao => %L::uuid, p_grupo => 'laboratorio', p_urgencia => %L, p_itens => %L::jsonb, p_observacao => %L)::text$q$,
    e2e.fbu(c.n, 'int'), CASE WHEN c.prioridade = 'emergencia' THEN 'urgente' ELSE 'rotina' END,
    (SELECT jsonb_agg(jsonb_build_object('procedimento', p, 'indicacao', c.hipotese, 'cid', c.cid))
       FROM unnest(ARRAY['0202010317', '0202010694', '0202010635', '0202010600'] || CASE WHEN c.n IN (2, 9, 10) THEN ARRAY['0202010732', '0202010538'] ELSE ARRAY[]::text[] END) p),
    'Colher antes do antibiótico; avisar o plantão se o potássio vier alterado (teste de fluxo B' || lpad(c.n::text, 2, '0') || ')'),
  'ok', 'ex_lab', false, 'int')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.exames_imagem', 'med', 'Cesta de imagem (RX de tórax PA) em pedido separado',
  format($q$SELECT public.pedir_exames_internacao(p_internacao => %L::uuid, p_grupo => 'imagem', p_urgencia => 'rotina', p_itens => %L::jsonb, p_observacao => %L)::text$q$,
    e2e.fbu(c.n, 'int'), jsonb_build_array(jsonb_build_object('procedimento', '0204030170', 'indicacao', c.hipotese, 'cid', c.cid)), 'Controle no leito (teste de fluxo)'),
  'ok', 'ex_img', false, 'int')
  FROM e2e.fb_coorte c WHERE c.n IN (2, 3, 5, 9) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.exames_ecg', 'med', 'ECG de controle (métodos gráficos)',
  format($q$SELECT public.pedir_exames_internacao(p_internacao => %L::uuid, p_grupo => 'grafico', p_urgencia => 'urgente', p_itens => '[{"procedimento":"0211020036"}]'::jsonb)::text$q$, e2e.fbu(c.n, 'int')),
  'ok', 'ex_ecg', false, 'int')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 7) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.exames_repetidos', 'med', 'Ação repetida: a mesma cesta de novo: deve recusar (já pedidos)',
  format($q$SELECT public.pedir_exames_internacao(%L::uuid, '[{"procedimento":"0202010317"},{"procedimento":"0202010694"}]'::jsonb, 'laboratorio', 'rotina', NULL)::text$q$, e2e.fbu(c.n, 'int')),
  'erro:já estão pedidos', NULL, false, 'ex_lab')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.exames_grupo_errado', 'med', 'Imagem dentro do pedido de laboratório: deve recusar',
  format($q$SELECT public.pedir_exames_internacao(%L::uuid, '[{"procedimento":"0204030153"}]'::jsonb, 'laboratorio', 'rotina', NULL)::text$q$, e2e.fbu(c.n, 'int')),
  'erro:vão em pedidos separados', NULL, false, 'int')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.exames_cid_invalido', 'med', 'CID do pedido em formato errado (registro do que o servidor faz; desfeito)',
  format($q$SELECT public.pedir_exames_internacao(%L::uuid, '[{"procedimento":"0202010473","cid":"XX"}]'::jsonb, 'laboratorio', 'rotina', NULL)::text$q$, e2e.fbu(c.n, 'int')),
  'registrar', NULL, true, 'int')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.exame_avulso', 'med', 'Exame avulso pelo nome (procalcitonina), sem código (registro; desfeito)',
  format($q$SELECT public.pedir_exames_internacao(%L::uuid, '[{"nome":"Procalcitonina"}]'::jsonb, 'laboratorio', 'rotina', NULL)::text$q$, e2e.fbu(c.n, 'int')),
  'registrar', NULL, true, 'int')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.pedido_gravado', 'banco', 'Pedidos do leito com observação, indicação e CID gravados; autor = login',
  format($q$SELECT e2e.fb_confere(count(*) >= 4 AND bool_and(ep.pedido_por = e2e.fb_login()) AND bool_and(ep.observacao LIKE 'Colher antes%%') AND bool_and(ep.indicacao = %L) AND bool_and(ep.cid = %L),
      count(*) || ' exames de laboratório; obs "' || left(min(ep.observacao), 40) || '…"; indicação ' || min(ep.indicacao) || '; CID ' || min(ep.cid))
    FROM public.exames_pedidos ep WHERE ep.internacao_id = %L AND ep.grupo = 'laboratorio'$q$, c.hipotese, c.cid, e2e.fbu(c.n, 'int')), 'ok', NULL, false, 'ex_lab')
  FROM e2e.fb_coorte c ORDER BY c.n;

-- impressão do pedido (a folha é do documento pedido_exames; médico e CRM do login)
-- achado B-02: o conteúdo que a tela montava (só "folhas", sem "itens") era recusado
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.imprimir_sem_itens', 'med', 'Conteúdo da tela antes do conserto B-02 (folhas, sem "itens"): o servidor recusa',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'pedido_exames', %L) ->> 'id')$q$, e2e.fbu(c.n, 'pac'),
    '{"pedido":{"folhas":[{"titulo":"","documento":"Solicitação de exames","grupos":[{"nome":"Laboratório","itens":["Creatinina","Ureia"]}]}],"carater":"Rotina","indicacao":"Teste","cid":"","obs_pedido":"","itens_n":2}}'),
  'erro:Marcar ao menos um exame', NULL, false, 'ex_lab')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.imprimir_sem_indicacao', 'med', 'Imprimir pedido sem indicação clínica: o servidor recusa (regra do documento)',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'pedido_exames', %L) ->> 'id')$q$, e2e.fbu(c.n, 'pac'),
    '{"pedido":{"itens":["Creatinina","Ureia"],"folhas":[{"titulo":"","documento":"Solicitação de exames","grupos":[{"nome":"Laboratório","itens":["Creatinina","Ureia"]}]}],"carater":"Rotina","indicacao":"","cid":"","obs_pedido":"","itens_n":2}}'),
  'erro:Indicação clínica', NULL, false, 'ex_lab')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.imprimir', 'med', 'Imprimir pedido: documento pedido_exames em folha única, com a observação do pedido',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'pedido_exames', %L) ->> 'id')$q$, e2e.fbu(c.n, 'pac'),
    jsonb_build_object('pedido', jsonb_build_object(
      'itens', (SELECT jsonb_agg(ep.exame ORDER BY ep.exame) FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.grupo = 'laboratorio'),
      'folhas', jsonb_build_array(jsonb_build_object('titulo', '', 'documento', 'Solicitação de exames', 'grupos', jsonb_build_array(
        jsonb_build_object('nome', 'Laboratório', 'itens', (SELECT jsonb_agg(ep.exame ORDER BY ep.exame) FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.grupo = 'laboratorio'))))),
      'carater', CASE WHEN c.prioridade = 'emergencia' THEN 'Urgência' ELSE 'Rotina' END, 'indicacao', c.hipotese, 'cid', c.cid,
      'obs_pedido', 'Colher antes do antibiótico; avisar o plantão se o potássio vier alterado (teste de fluxo B' || lpad(c.n::text, 2, '0') || ')',
      'itens_n', (SELECT count(*) FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.grupo = 'laboratorio')))::text),
  'ok', 'doc_exames', false, 'ex_lab')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 6) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.imprimir_nao_duplica', 'banco', 'A impressão não criou exame de novo (gatilho pedido_emitido_vira_exames)',
  format($q$SELECT e2e.fb_confere(count(*) = %L::int, count(*) || ' exames de laboratório na internação') FROM public.exames_pedidos ep WHERE ep.internacao_id = %L AND ep.grupo = 'laboratorio'$q$,
    CASE WHEN c.n = 2 THEN 6 ELSE 4 END, e2e.fbu(c.n, 'int')), 'ok', NULL, false, 'doc_exames')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 6) ORDER BY c.n;

-- planilha: lançamento à mão (só nome e valor) e "alterado"
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.planilha_lancar', 'med', 'Lança o resultado de creatinina e potássio na planilha (coleta de agora)',
  format($q$SELECT left(public.registrar_resultado_estruturado(%L::uuid, now() - interval '20 minutes', %L::jsonb)::text, 120)
             || left(public.registrar_resultado_estruturado(%L::uuid, now() - interval '20 minutes', %L::jsonb)::text, 40)$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010317'),
    jsonb_build_array(jsonb_build_object('analito', 'Creatinina', 'valor', (0.8 + c.n * 0.1)::text)),
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010600'),
    jsonb_build_array(jsonb_build_object('analito', 'Potássio', 'valor', (3.6 + c.n * 0.2)::text))),
  'ok', 'planilha', false, 'ex_lab')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.planilha_coleta_futura', 'med', 'Coleta no futuro: deve recusar',
  format($q$SELECT public.registrar_resultado_estruturado(%L::uuid, now() + interval '2 hours', '[{"analito":"Ureia","valor":"40"}]'::jsonb)::text$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010694')), 'erro:A coleta não pode ser no futuro', NULL, false, 'ex_lab')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.planilha_de_novo', 'med', 'Ação repetida: lançar de novo no exame que já tem resultado: deve recusar (retificar com motivo)',
  format($q$SELECT public.registrar_resultado_estruturado(%L::uuid, now() - interval '5 minutes', '[{"analito":"Creatinina","valor":"9,9"}]'::jsonb)::text$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010317')), 'erro:já tem resultado', NULL, false, 'planilha')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.planilha_enfermeiro', 'enf', 'Enfermeiro tenta lançar resultado na planilha (registro do que o servidor faz; desfeito)',
  format($q$SELECT left(public.registrar_resultado_estruturado(%L::uuid, now() - interval '5 minutes', '[{"analito":"Ureia","valor":"40"}]'::jsonb)::text, 100)$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010694')), 'registrar', NULL, true, 'ex_lab')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.alterado_sem_resultado', 'med', 'Marcar "alterado" em exame sem resultado: deve recusar',
  format('SELECT public.marcar_resultado_alterado(%L::uuid, true)::text',
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010694')), 'erro:ainda não tem resultado', NULL, false, 'ex_lab')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.alterado_outro_perfil', x.papel, 'Outro perfil (' || x.papel || ') tenta marcar "alterado": deve recusar',
  format('SELECT public.marcar_resultado_alterado(%L::uuid, true)::text',
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010600')), 'erro:quem marca o resultado como alterado é o médico', NULL, false, 'planilha')
  FROM e2e.fb_coorte c CROSS JOIN (VALUES ('enf'), ('nir'), ('ges')) x(papel) WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.alterado', 'med', 'Médico marca o potássio como "alterado"',
  format($q$SELECT (public.marcar_resultado_alterado(%L::uuid, true) ->> 'pode_marcar_alterado')$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010600')), 'ok', 'alterado', false, 'planilha')
  FROM e2e.fb_coorte c WHERE c.n IN (2, 4, 7, 9, 10) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.alterado_banco', 'banco', 'Alterado com autor = login; crítico não muda (segue só do laboratório)',
  format($q$SELECT e2e.fb_confere(r.alterado_em IS NOT NULL AND r.alterado_por = e2e.fb_login() AND NOT coalesce(r.critico, false), 'alterado_em ' || r.alterado_em::text || ', crítico ' || coalesce(r.critico::text, 'nulo'))
    FROM public.exame_resultados r JOIN public.exames_pedidos ep ON ep.id = r.exame_id WHERE ep.internacao_id = %L AND ep.procedimento = '0202010600' AND r.vigente$q$, e2e.fbu(c.n, 'int')),
  'ok', NULL, false, 'alterado')
  FROM e2e.fb_coorte c WHERE c.n IN (2, 4, 7, 9, 10) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.alterado_desmarca_remarca', 'med', 'Tira e marca de novo o "alterado" (fica na auditoria)',
  format($q$SELECT (public.marcar_resultado_alterado(%1$L::uuid, false) ->> 'id') || ' / ' || (public.marcar_resultado_alterado(%1$L::uuid, true) ->> 'id')$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010600')), 'ok', NULL, false, 'alterado')
  FROM e2e.fb_coorte c WHERE c.n = 2;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.planilha_ler', 'med', 'Planilha: resultados da internação com os valores à mão, a coleta e o alterado',
  format($q$SELECT e2e.fb_confere(jsonb_typeof(x) IN ('array', 'object') AND x::text LIKE '%%Creatinina%%' AND x::text LIKE '%%Potássio%%', left(x::text, 420)) FROM (SELECT public.resultados_da_internacao(%L::uuid) x) z$q$, e2e.fbu(c.n, 'int')),
  'ok', NULL, false, 'planilha')
  FROM e2e.fb_coorte c WHERE c.n IN (2) ORDER BY c.n;

-- cancelar exame com motivo
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.cancelar_sem_motivo', 'med', 'Cancelar exame com motivo curto: deve recusar',
  format($q$SELECT public.resolver_exame(%L::uuid, NULL, 'erro')::text$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010635')), 'erro', NULL, false, 'ex_lab')
  FROM e2e.fb_coorte c WHERE c.n = 3;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.cancelar', 'med', 'Cancela o sódio com motivo',
  format($q$SELECT public.resolver_exame(%L::uuid, NULL, 'Pedido em duplicidade com o da porta (teste de fluxo)')::text || 'cancelado'$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010635')), 'ok', 'cancelado', false, 'ex_lab')
  FROM e2e.fb_coorte c WHERE c.n IN (3, 8) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.6.laudo_sem_arquivo', 'med', 'Anexar laudo com caminho que não existe no armazenamento (registro; desfeito)',
  format($q$SELECT left(public.registrar_resultado_exame(p_exame => %L::uuid, p_pdf_caminho => %L, p_pdf_nome => 'laudo-teste.pdf')::text, 150)$q$,
    (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(c.n, 'int') AND ep.procedimento = '0202010694'),
    e2e.fb_upa()::text || '/' || e2e.fbv(c.n, 'pac') || '/nao-existe.pdf'), 'registrar', NULL, true, 'ex_lab')
  FROM e2e.fb_coorte c WHERE c.n = 1;

SELECT txt FROM _r ORDER BY o;
--FIM
COMMIT;
