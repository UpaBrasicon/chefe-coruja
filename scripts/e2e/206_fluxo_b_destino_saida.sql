-- ════════════════════════════════════════════════════════════════════════════
-- Teste de fluxo B, fase 6: o destino aceita (ou recusa), a origem emite o
-- documento de transferência, dá a alta por transferência, o paciente sai e a
-- chegada é registrada. Rede: B01, B02 (aerossol), B07. Fora da rede: B03, B05, B06.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE TEMP TABLE _r (o serial, txt text) ON COMMIT DROP;
CREATE TEMP TABLE _lt ON COMMIT DROP AS
SELECT l.identificador AS ident, l.id FROM public.leitos l WHERE l.setor_id = '32000000-0000-4000-8000-0000000000d1';

-- ── destino da rede ─────────────────────────────────────────────────────────
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.12.destino_lista', x.papel, 'Hospital de Referência (' || x.papel || ') vê os 3 pedidos aguardando o aceite',
  format($q$SELECT e2e.fb_confere(count(*) = 3, count(*) || ' pedidos B aguardando o aceite') FROM unnest(%L::text[]) i, (SELECT public.regulacao_destino_lista(%L::uuid)::text l) z WHERE z.l LIKE '%%' || i || '%%'$q$,
    ARRAY[e2e.fbv(1, 'reg'), e2e.fbv(2, 'reg'), e2e.fbv(7, 'reg')], e2e.fb_hosp()))
  FROM (VALUES ('dmed'), ('dges')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.12.destino_nao_ve_os_outros', 'dmed', 'O destino não vê pedidos que não são para ele (B03 a B06, B08 a B10)',
  format($q$SELECT e2e.fb_confere(count(*) = 0, count(*) || ' pedidos de outros destinos na lista do hospital') FROM unnest(%L::text[]) i, (SELECT public.regulacao_destino_lista(%L::uuid)::text l) z WHERE z.l LIKE '%%' || i || '%%'$q$,
    (SELECT array_agg(e2e.fbv(c.n, 'reg')) FROM e2e.fb_coorte c WHERE c.n NOT IN (1, 2, 7)), e2e.fb_hosp()));
INSERT INTO _r (txt)
SELECT e2e.fb(3, 'FB.12.destino_nao_abre_pedido_alheio', 'dmed', 'Médico do hospital tenta abrir o detalhe de um pedido que não é para ele: deve recusar',
  format('SELECT left(public.regulacao_detalhe(%L::uuid)::text, 80)', e2e.fbu(3, 'reg')), 'erro');
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.12.' || x.passo, x.papel, x.descricao, format(x.sql, e2e.fbu(1, 'reg'), (SELECT id FROM _lt WHERE ident = 'UTI-01')), x.esperado, NULL, true, 'autorizada')
  FROM (VALUES
    (1, 'origem_nao_aceita', 'med', 'Médico da origem tenta aceitar pelo destino: deve recusar', 'SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid, NULL)::text', 'erro:Responde pelo destino'),
    (2, 'regulador_nao_aceita', 'reg', 'Regulador tenta aceitar pelo destino da rede: deve recusar', 'SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid, NULL)::text', 'erro:Responde pelo destino'),
    (3, 'aceitar_sem_leito', 'dmed', 'Aceitar pedido de leito sem escolher o leito: deve recusar', 'SELECT public.regulacao_destino_aceitar(%L::uuid, NULL, NULL)::text', 'erro:Escolha o leito'),
    (4, 'saida_antes_do_aceite', 'med', 'Marcar a saída antes do aceite do destino: deve recusar', 'SELECT public.regulacao_marcar_saida(%L::uuid)::text', 'erro:Só sai o paciente com o pedido aceito'),
    (5, 'resposta_externa_em_destino_da_rede', 'reg', 'Registrar resposta externa num destino da rede: deve recusar', $q$SELECT public.regulacao_registrar_resposta_externa(%L::uuid, true, 'plantonista', 'telefone')::text$q$, 'erro:não está aguardando um serviço de fora')
  ) x(o, passo, papel, descricao, sql, esperado) ORDER BY x.o;
-- B02 (aerossol): o leito comum é recusado; registro do leito de isolamento sem pressão negativa
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.12.aerossol_leito_comum', 'dmed', 'Aceitar o paciente em aerossol num leito comum (UTI-01): deve recusar',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid, NULL)::text', e2e.fbu(2, 'reg'), (SELECT id FROM _lt WHERE ident = 'UTI-01')), 'erro:não é de isolamento', NULL, false, 'autorizada');
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.12.aerossol_isolamento_sem_pressao', 'dmed', 'Aceitar o paciente em aerossol em leito de isolamento SEM pressão negativa (UTI-ISO-1): registro do que o servidor faz (desfeito)',
  format($q$SELECT (public.regulacao_destino_aceitar(%L::uuid, %L::uuid, NULL) ->> 'status')$q$, e2e.fbu(2, 'reg'), (SELECT id FROM _lt WHERE ident = 'UTI-ISO-1')), 'registrar', NULL, true, 'autorizada');
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.12.aceitar', 'dmed', 'Médico do hospital aceita e reserva o leito ' || x.leito,
  format($q$SELECT (public.regulacao_destino_aceitar(%L::uuid, %L::uuid, %L) ->> 'status')$q$, e2e.fbu(c.n, 'reg'), (SELECT id FROM _lt WHERE ident = x.leito), 'Leito ' || x.leito || ' reservado (teste de fluxo)'),
  'ok', 'aceita', false, 'autorizada')
  FROM e2e.fb_coorte c JOIN (VALUES (1, 'UTI-01'), (2, 'UTI-ISO-2')) x(n, leito) ON x.n = c.n ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.12.aceitar_de_novo', 'dmed', 'Ação repetida: aceitar de novo o pedido já aceito: deve recusar',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid, NULL)::text', e2e.fbu(1, 'reg'), (SELECT id FROM _lt WHERE ident = 'UTI-02')), 'erro:não está aguardando o aceite', NULL, false, 'aceita');
INSERT INTO _r (txt)
SELECT e2e.fb(7, 'FB.12.aceitar_leito_reservado', 'dmed', 'Aceitar o B07 no leito já reservado para o B01 (UTI-01): deve recusar',
  format('SELECT public.regulacao_destino_aceitar(%L::uuid, %L::uuid, NULL)::text', e2e.fbu(7, 'reg'), (SELECT id FROM _lt WHERE ident = 'UTI-01')), 'erro', NULL, false, 'autorizada');
INSERT INTO _r (txt)
SELECT e2e.fb(7, 'FB.12.recusar_sem_motivo', 'dges', 'Destino recusa sem motivo da lista: deve recusar',
  format($q$SELECT public.regulacao_destino_recusar(%L::uuid, 'lotado', 'Sem leito no momento (teste)')::text$q$, e2e.fbu(7, 'reg')), 'erro:Motivo', NULL, false, 'autorizada');
INSERT INTO _r (txt)
SELECT e2e.fb(7, 'FB.12.recusar', 'dges', 'Gestor do hospital recusa com motivo (sem recurso: neurologia de plantão)',
  format($q$SELECT left(public.regulacao_destino_recusar(%L::uuid, 'sem_recurso', 'Sem neurologista e sem tomografia nas próximas horas (teste de fluxo).')::text, 60) || 'recusado'$q$, e2e.fbu(7, 'reg')), 'ok', 'recusado', false, 'autorizada');
INSERT INTO _r (txt)
SELECT e2e.fb(7, 'FB.12.recusa_volta_a_central', 'banco', 'Depois da recusa do destino o pedido volta à fila da central, com o motivo guardado e aviso',
  format($q$SELECT e2e.fb_confere(s.status IN ('em_analise', 'enviada') AND s.destino_resposta = 'recusada'
      AND EXISTS (SELECT 1 FROM public.regulacao_destino_respostas r WHERE r.solicitacao_id = s.id AND r.resposta = 'recusada' AND r.motivo = 'sem_recurso'),
      s.status || '; resposta ' || coalesce(s.destino_resposta, '-')) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.fbu(7, 'reg')), 'ok', NULL, false, 'recusado');
INSERT INTO _r (txt)
SELECT e2e.fb(7, 'FB.12.autorizar_de_novo', 'reg', 'Regulador confirma a tomografia por telefone e autoriza de novo para o Hospital de Referência',
  format($q$SELECT (public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', now() + interval '1 hour', 'Tomografia confirmada por telefone com a direção (teste de fluxo)') ->> 'status')$q$, e2e.fbu(7, 'reg'), e2e.fb_hosp()),
  'ok', 'autorizada2', false, 'recusado');
INSERT INTO _r (txt)
SELECT e2e.fb(7, 'FB.12.aceitar', 'dmed', 'Médico do hospital aceita e reserva o leito UTI-02',
  format($q$SELECT (public.regulacao_destino_aceitar(%L::uuid, %L::uuid, 'Leito UTI-02 reservado (teste de fluxo)') ->> 'status')$q$, e2e.fbu(7, 'reg'), (SELECT id FROM _lt WHERE ident = 'UTI-02')), 'ok', 'aceita', false, 'autorizada2');

-- ── destino de fora da rede: a central registra a resposta ───────────────────
INSERT INTO _r (txt)
SELECT e2e.fb(3, 'FB.12.resposta_externa_pela_origem', 'med', 'Médico da origem tenta registrar a resposta do serviço de fora: deve recusar',
  format($q$SELECT public.regulacao_registrar_resposta_externa(%L::uuid, true, 'plantonista do HDT', 'telefone')::text$q$, e2e.fbu(3, 'reg')), 'erro:Quem registra a resposta do serviço de fora é o regulador', NULL, false, 'autorizada');
INSERT INTO _r (txt)
SELECT e2e.fb(6, 'FB.12.externo_recusa', 'reg', 'A maternidade de fora recusa (sem vaga): a central registra com motivo',
  format($q$SELECT left(public.regulacao_registrar_resposta_externa(%L::uuid, false, 'obstetra de plantão', 'telefone', 'sem_vaga', 'UTI materna lotada (teste de fluxo).')::text, 40) || 'recusa registrada'$q$, e2e.fbu(6, 'reg')), 'ok', 'ext_recusa', false, 'autorizada');
INSERT INTO _r (txt)
SELECT e2e.fb(6, 'FB.12.externo_autorizar_outro', 'reg', 'Regulador autoriza para outra maternidade de fora',
  format($q$SELECT (public.regulacao_autorizar(%L::uuid, 'externo', NULL, 'Hospital Materno-Infantil (fora da rede)', 'ambulancia_avancada', now() + interval '2 hours', 'Vaga confirmada por telefone (teste de fluxo)') ->> 'status')$q$, e2e.fbu(6, 'reg')),
  'ok', 'autorizada2', false, 'ext_recusa');
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.12.externo_aceita', 'reg', 'A central registra o aceite do serviço de fora (quem confirmou e por qual meio)',
  format($q$SELECT (public.regulacao_registrar_resposta_externa(%L::uuid, true, %L, 'telefone') ->> 'status')$q$, e2e.fbu(c.n, 'reg'),
    CASE c.n WHEN 3 THEN 'infectologista de plantão' WHEN 5 THEN 'pediatra de plantão' ELSE 'obstetra de plantão' END), 'ok', 'aceita', false, 'autorizada')
  FROM e2e.fb_coorte c WHERE c.n IN (3, 5, 6) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.12.aviso_aceite', 'banco', 'Aviso do aceite do destino chegou ao solicitante na origem',
  format($q$SELECT e2e.fb_confere(count(*) >= 1, coalesce(string_agg(n.tipo || ': ' || left(n.mensagem, 90), ' | '), 'nenhum aviso de aceite')) FROM public.notificacoes_plantonista n
    WHERE n.perfil_id = e2e.fb_login() AND n.unidade_id = e2e.fb_upa() AND n.tipo LIKE 'reg\_%%' AND n.tipo LIKE '%%\_' || %L AND n.mensagem ILIKE '%%aceit%%'$q$, e2e.fbv(c.n, 'num')), 'ok', NULL, false, 'aceita')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 5, 6, 7) ORDER BY c.n;

-- ── origem: checklist, documento de transferência, alta e saída ──────────────
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.13.saida_sem_alta', x.papel, 'Marcar a saída com o paciente ainda internado na origem (' || x.papel || '): deve recusar',
  format('SELECT public.regulacao_marcar_saida(%L::uuid)::text', e2e.fbu(1, 'reg')), 'erro:a alta por transferência marca a saída', NULL, false, 'aceita')
  FROM (VALUES ('med'), ('nir')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.13.alta_sem_documento', 'med', 'Alta por transferência sem o documento de transferência: deve recusar',
  format($q$SELECT public.dar_alta(%L::uuid, 'transferencia_externa', %L, now(), NULL, 'Transferido pela regulação (teste)', '{"destino":"Hospital de Referência"}'::jsonb)::text$q$, e2e.fbu(1, 'int'), c.cid),
  'erro:Emita o documento de transferência', NULL, false, 'aceita')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.13.checklist_enfermeiro_item_medico', 'enf', 'Enfermeiro tenta marcar item do médico no checklist de transferência: deve recusar',
  format($q$SELECT public.marcar_item_transferencia(%L::uuid, 'regulacao', 'feito', %L)::text$q$, e2e.fbu(1, 'pac'), e2e.fbv(1, 'num')), 'erro:Este item é do médico', NULL, false, 'aceita');
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.13.checklist', 'med', 'Médico marca no checklist: regulação (nº do pedido) e paciente estabilizado',
  format($q$SELECT left(public.marcar_item_transferencia(%1$L::uuid, 'regulacao', 'feito', %2$L)::text, 40) || left(public.marcar_item_transferencia(%1$L::uuid, 'estabilizado', 'feito', NULL)::text, 40)$q$, e2e.fbu(c.n, 'pac'), 'Regulação nº ' || e2e.fbv(c.n, 'num')),
  'registrar', NULL, false, 'aceita')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 5, 6, 7) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.13.documento_' || x.papel, x.papel, 'Outro perfil (' || x.papel || ') tenta emitir o documento de transferência: deve recusar',
  format($q$SELECT public.emitir_documento_transferencia(%L::uuid, '{"resumo_clinico":"Resumo clínico de teste de permissão","condutas":"Condutas de teste","motivo":"Motivo de teste de permissão"}'::jsonb)::text$q$, e2e.fbu(1, 'pac')), 'erro', NULL, true, 'aceita')
  FROM (VALUES ('enf'), ('nir'), ('ges')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.13.documento', 'med', 'Médico emite o documento de transferência (resumo clínico, condutas e motivo)',
  format($q$SELECT (public.emitir_documento_transferencia(%L::uuid, %L::jsonb) ->> 'id')$q$, e2e.fbu(c.n, 'pac'),
    jsonb_build_object('resumo_clinico', c.quadro, 'condutas', 'Exames da porta e do leito, medicação conforme a prescrição (dose: texto de teste) e monitorização.',
      'motivo', 'Necessidade de leito ' || replace(c.tipo_leito, '_', ' ') || ' não disponível na UPA; regulação nº ' || e2e.fbv(c.n, 'num') || '.')), 'ok', 'doc_transf', false, 'aceita')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 5, 6, 7) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.13.documento_isolamento', 'banco', 'Bloco de isolamento no documento de transferência (B02: aerossol, marcado no atendimento; B03: contato + aerossol, só no pedido)',
  format($q$SELECT 'tipo ' || d.tipo_documento || '; isolamento no conteúdo: ' || (d.conteudo ILIKE '%%isolamento%%') || '; trecho: ' || coalesce(substring(d.conteudo from '.{0,60}isolamento.{0,160}'), '(nada)')
    FROM public.documentos_clinicos d WHERE d.id = %L$q$, e2e.fbu(c.n, 'doc_transf')), 'registrar', NULL, false, 'doc_transf')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(2, 'FB.13.documento_repetido', 'med', 'Ação repetida: emitir de novo o documento de transferência sem motivo de nova versão: deve recusar',
  format($q$SELECT public.emitir_documento_transferencia(%L::uuid, '{"resumo_clinico":"Resumo clínico repetido de teste","condutas":"Condutas de teste","motivo":"Motivo repetido de teste"}'::jsonb)::text$q$, e2e.fbu(2, 'pac')),
  'erro:Já há documento de transferência', NULL, false, 'doc_transf');
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.13.alta_' || x.papel, x.papel, 'Outro perfil (' || x.papel || ') tenta dar a alta por transferência: deve recusar',
  format($q$SELECT public.dar_alta(%L::uuid, 'transferencia_externa', 'I21.9', now(), NULL, 'Transferido pela regulação (teste)', '{"destino":"Hospital de Referência"}'::jsonb)::text$q$, e2e.fbu(1, 'int')), 'erro', NULL, true, 'doc_transf')
  FROM (VALUES ('enf'), ('nir'), ('ges')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.13.alta', 'med', 'Médico dá a alta por transferência (libera o leito da UPA)',
  format($q$SELECT public.dar_alta(%L::uuid, 'transferencia_externa', %L, now(), NULL, %L, %L::jsonb)::text || 'alta dada'$q$, e2e.fbu(c.n, 'int'), c.cid,
    'Transferido pela regulação nº ' || e2e.fbv(c.n, 'num') || ' (teste de fluxo)',
    jsonb_build_object('destino', CASE WHEN c.n IN (1, 2, 7) THEN 'Hospital de Referência (homologação)' WHEN c.n = 3 THEN 'Hospital de Doenças Tropicais (fora da rede)'
                                       WHEN c.n = 5 THEN 'Hospital Infantil de Referência (fora da rede)' ELSE 'Hospital Materno-Infantil (fora da rede)' END,
                       'regulacao_id', e2e.fbv(c.n, 'reg'))), 'ok', 'alta', false, 'doc_transf')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 5, 6, 7) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.13.depois_da_alta', 'banco', 'Depois da alta: internação encerrada, leito da UPA saiu de "ocupado" e o pedido de regulação',
  format($q$SELECT i.status || '; leito ' || coalesce((SELECT l.identificador || '=' || l.status FROM public.eventos_leito ev JOIN public.leitos l ON l.id = ev.leito_id WHERE l.setor_id IN (SELECT id FROM public.setores WHERE unidade_id = e2e.fb_upa()) AND l.identificador = %L ORDER BY ev.created_at DESC LIMIT 1), '?')
      || '; regulação ' || (SELECT s.status || coalesce(' saída ' || to_char(s.saida_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'), ' sem saída') FROM public.regulacao_solicitacoes s WHERE s.id = %L)
    FROM public.internacoes i WHERE i.id = %L$q$, c.leito, e2e.fbu(c.n, 'reg'), e2e.fbu(c.n, 'int')), 'registrar', NULL, false, 'alta')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 5, 6, 7) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.13.saida', CASE WHEN c.n IN (2, 5) THEN 'nir' ELSE 'med' END, 'Marca a saída do paciente (' || CASE WHEN c.n IN (2, 5) THEN 'NIR' ELSE 'médico' END || ')',
  format($q$SELECT (public.regulacao_marcar_saida(%L::uuid) ->> 'status')$q$, e2e.fbu(c.n, 'reg')), 'registrar', NULL, false, 'alta')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 5, 6, 7) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.13.em_transito', 'banco', 'Pedido em trânsito, com hora de saída e autor = login',
  format($q$SELECT e2e.fb_confere(s.status = 'em_transito' AND s.saida_em IS NOT NULL AND s.saida_por = e2e.fb_login(), s.status || ' desde ' || to_char(s.saida_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'))
    FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.fbu(c.n, 'reg')), 'ok', 'saiu', false, 'alta')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 3, 5, 6, 7) ORDER BY c.n;

-- ── chegada ─────────────────────────────────────────────────────────────────
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.14.chegada_pela_origem', x.papel, 'A origem (' || x.papel || ') tenta marcar a chegada no destino: deve recusar',
  format('SELECT public.regulacao_marcar_chegada(%L::uuid, true, NULL)::text', e2e.fbu(1, 'reg')), 'erro:Marca a chegada', NULL, true, 'saiu')
  FROM (VALUES ('med'), ('nir')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(3, 'FB.14.nao_chegou_sem_texto', 'reg', 'Registrar "não chegou" sem dizer o que aconteceu: deve recusar',
  format('SELECT public.regulacao_marcar_chegada(%L::uuid, false, NULL)::text', e2e.fbu(3, 'reg')), 'erro:Escreva o que aconteceu', NULL, false, 'saiu');
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.14.chegada_rede', 'dmed', 'Hospital de Referência registra a chegada: cadastro novo e internação no leito reservado',
  format($q$SELECT (public.regulacao_marcar_chegada(p_id => %L::uuid, p_chegou => true, p_observacao => 'Chegou estável, recebido pela equipe da UTI (teste de fluxo)', p_cadastro_novo => true) ->> 'status')$q$, e2e.fbu(c.n, 'reg')),
  'ok', 'chegou', false, 'saiu')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 7) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.14.chegada_externo', 'reg', 'A central registra a chegada no serviço de fora da rede',
  format($q$SELECT (public.regulacao_marcar_chegada(%L::uuid, true, 'Chegada confirmada por telefone pelo serviço de destino (teste de fluxo)') ->> 'status')$q$, e2e.fbu(c.n, 'reg')),
  'ok', 'chegou', false, 'saiu')
  FROM e2e.fb_coorte c WHERE c.n IN (3, 5, 6) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.14.chegada_de_novo', 'dmed', 'Ação repetida: registrar a chegada de novo: deve recusar',
  format($q$SELECT public.regulacao_marcar_chegada(p_id => %L::uuid, p_chegou => true, p_cadastro_novo => true)::text$q$, e2e.fbu(1, 'reg')), 'erro', NULL, false, 'chegou');
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.14.realizada', 'banco', 'Pedido realizado; na rede, o paciente está internado no leito reservado do hospital' || CASE WHEN c.n = 2 THEN ', levando o isolamento' ELSE '' END,
  format($q$SELECT e2e.fb_confere(s.status = 'realizada' AND s.chegada_em IS NOT NULL AND (%L::boolean IS NOT TRUE OR EXISTS (
        SELECT 1 FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.unidade_id = e2e.fb_hosp() AND i.data_alta IS NULL AND l.identificador = %L AND l.status = 'ocupado')),
      s.status || '; destino: ' || coalesce((SELECT string_agg(l.identificador || '=' || l.status || ' (' || pa.nome || coalesce(', isolamento ' || (SELECT string_agg(ip.tipo, '+') FROM public.isolamentos_paciente ip WHERE ip.paciente_id = pa.id AND ip.retirado_em IS NULL), '') || ')', '; ')
          FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id JOIN public.pacientes pa ON pa.id = i.paciente_id
         WHERE i.unidade_id = e2e.fb_hosp() AND i.data_alta IS NULL AND l.identificador = %L), 'fora da rede'))
    FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, c.n IN (1, 2, 7), x.leito, x.leito, e2e.fbu(c.n, 'reg')), 'ok', NULL, false, 'chegou')
  FROM e2e.fb_coorte c LEFT JOIN (VALUES (1, 'UTI-01'), (2, 'UTI-ISO-2'), (7, 'UTI-02')) x(n, leito) ON x.n = c.n WHERE c.n IN (1, 2, 3, 5, 6, 7) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.14.linha_do_tempo', 'banco', 'Linha do tempo do pedido, um evento por passo',
  format($q$SELECT string_agg(e.evento, ' → ' ORDER BY e.em, e.ctid) FROM public.regulacao_eventos e WHERE e.solicitacao_id = %L$q$, e2e.fbu(c.n, 'reg')), 'registrar', NULL, false, 'reg')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.14.vinculos_de_volta', 'banco', 'No fim, os vínculos e a marca de super admin do login estão como antes',
  $q$SELECT e2e.fb_confere(count(*) FILTER (WHERE NOT ativo) = 0 AND EXISTS (SELECT 1 FROM public.super_admins WHERE perfil_id = e2e.fb_login()), count(*) || ' vínculos ativos, super admin presente') FROM public.vinculos WHERE perfil_id = e2e.fb_login()$q$);

SELECT txt FROM _r ORDER BY o;
--FIM
COMMIT;
