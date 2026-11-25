-- ════════════════════════════════════════════════════════════════════════════
-- Teste de fluxo B, fase 4: o médico pede a vaga na regulação (leito, CID
-- compatível com o SIGTAP, isolamento em alguns casos, com os tipos novos
-- reverso e contato + aerossol). B08 é aberto pelo NIR em nome do médico.
-- Caminhos errados antes: sem CID, CID incompatível, perfil errado, NIR sem médico.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE TEMP TABLE _r (o serial, txt text) ON COMMIT DROP;

-- preparo do destino: o Hospital de Referência ganha dois leitos de isolamento
-- (um com pressão negativa), pelo gestor da unidade, como na tela Setores
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.7.destino_leitos_isolamento', 'dges', 'Gestor do Hospital de Referência cadastra UTI-ISO-1 (isolamento) e UTI-ISO-2 (isolamento com pressão negativa)',
  $q$WITH n AS (INSERT INTO public.leitos (setor_id, identificador, tipo, pressao_negativa)
               SELECT '32000000-0000-4000-8000-0000000000d1', v.i, 'isolamento', v.p FROM (VALUES ('UTI-ISO-1', false), ('UTI-ISO-2', true)) v(i, p)
                WHERE NOT EXISTS (SELECT 1 FROM public.leitos l WHERE l.setor_id = '32000000-0000-4000-8000-0000000000d1' AND l.identificador = v.i)
               RETURNING identificador)
     SELECT coalesce((SELECT string_agg(identificador, ', ') FROM n), 'já existiam')$q$);

-- montagem do pedido de cada paciente (como a tela NovaSolicitacao manda)
CREATE TEMP TABLE _ped ON COMMIT DROP AS
SELECT c.n, jsonb_build_object('tipo', 'leito', 'tipo_leito', c.tipo_leito, 'procedimento', c.proc, 'cid', c.cid, 'carater', 'urgencia',
    'prioridade', c.prioridade, 'destino_tipo', 'a_definir', 'vulnerabilidades', to_jsonb(c.vuln), 'internacao_id', e2e.fbv(c.n, 'int'),
    'quadro_clinico', c.quadro, 'hipotese', c.hipotese, 'tempo_evolucao', 'Horas a dias (teste de fluxo)',
    'sinais_vitais', (SELECT string_agg(k || ' ' || v, ', ') FROM jsonb_each_text(c.sinais) x(k, v)),
    'exames', 'Hemograma e PCR da porta; creatinina e potássio lançados na planilha (teste de fluxo)',
    'medicacoes', 'Dipirona conforme a prescrição da porta (dose: texto de teste)', 'telefone_contato', '(62) 3000-00' || lpad(c.n::text, 2, '0'),
    'isolamento', c.iso_tipo IS NOT NULL, 'isolamento_tipo', c.iso_tipo) AS d
  FROM e2e.fb_coorte c;

-- caminhos errados (B07)
INSERT INTO _r (txt)
SELECT e2e.fb(7, 'FB.7.' || x.passo, x.papel, x.descricao,
  format('SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb)::text', e2e.fb_upa(), e2e.fbu(7, 'pac'), p.d || x.troca), x.esperado, NULL, true, 'int')
  FROM _ped p CROSS JOIN (VALUES
    (1, 'sem_cid', 'med', 'Pedido sem CID: deve recusar', '{"cid":""}'::jsonb, 'erro:Informe um CID-10 válido'),
    (2, 'cid_inexistente', 'med', 'CID que não existe (Z99.99): deve recusar', '{"cid":"Z99.99"}'::jsonb, 'erro:Informe um CID-10 válido'),
    (3, 'cid_incompativel', 'med', 'CID J18.9 no procedimento de AVC (0303040149): deve recusar pelo SIGTAP', '{"cid":"J18.9"}'::jsonb, 'erro:não é compatível com o procedimento'),
    (4, 'sem_procedimento', 'med', 'Sem procedimento SIGTAP: deve recusar', '{"procedimento":""}'::jsonb, 'erro:Informe o procedimento do SIGTAP'),
    (5, 'quadro_curto', 'med', 'Quadro clínico com 12 letras: deve recusar', '{"quadro_clinico":"AVC há 2 hrs"}'::jsonb, 'erro:Confira o pedido'),
    (6, 'sem_tipo_leito', 'med', 'Leito sem tipo de leito: deve recusar', '{"tipo_leito":""}'::jsonb, 'erro:Confira o pedido'),
    (7, 'isolamento_sem_tipo', 'med', 'Isolamento marcado sem tipo: deve recusar', '{"isolamento":true,"isolamento_tipo":""}'::jsonb, 'erro:Confira o pedido'),
    (8, 'isolamento_tipo_invalido', 'med', 'Tipo de isolamento que não existe: deve recusar', '{"isolamento":true,"isolamento_tipo":"respiratorio"}'::jsonb, 'erro:Confira o pedido'),
    (9, 'enfermeiro_nao_pede', 'enf', 'Enfermeiro tenta pedir a vaga: deve recusar', '{}'::jsonb, 'erro:Abre a solicitação o médico, o gestor ou o NIR'),
    (10, 'recepcao_nao_pede', 'rec', 'Recepção tenta pedir a vaga: deve recusar', '{}'::jsonb, 'erro:Abre a solicitação o médico, o gestor ou o NIR'),
    (11, 'nir_sem_medico', 'nir', 'NIR abre o pedido sem médico assistente: deve recusar', '{}'::jsonb, 'erro:O NIR abre o pedido com o médico assistente'),
    (12, 'regulador_da_upa_nao_pede', 'reg', 'Regulador da central (sem papel na UPA) tenta abrir pedido pela UPA: deve recusar', '{}'::jsonb, 'erro:Abre a solicitação o médico, o gestor ou o NIR'),
    (13, 'internacao_de_outro', 'med', 'Internação que não é do paciente: deve recusar', jsonb_build_object('internacao_id', e2e.fbv(1, 'int')), 'erro:A internação informada')
  ) x(o, passo, papel, descricao, troca, esperado)
 WHERE p.n = 7 ORDER BY x.o;
INSERT INTO _r (txt)
SELECT e2e.fb(7, 'FB.7.paciente_de_outra_unidade', 'med', 'Pedido pela Central para paciente da UPA (unidade errada): deve recusar',
  format('SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb)::text', e2e.fb_hosp(), e2e.fbu(7, 'pac'), p.d), 'erro', NULL, true, 'int')
  FROM _ped p WHERE p.n = 7;

-- o pedido
INSERT INTO _r (txt)
SELECT e2e.fb(p.n, 'FB.7.solicitar', 'med',
  'Médico pede leito ' || (p.d ->> 'tipo_leito') || ' (' || (p.d ->> 'prioridade') || ')'
    || CASE WHEN (p.d ->> 'isolamento')::boolean THEN ', isolamento ' || (p.d ->> 'isolamento_tipo') ELSE '' END,
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, e2e.fb_upa(), e2e.fbu(p.n, 'pac'), p.d), 'ok', 'reg', false, 'int')
  FROM _ped p ORDER BY p.n;
-- o NIR abre em nome de um médico: precisa de OUTRA pessoa médica na unidade (o login de teste é um só).
-- Passo desfeito: um perfil de outra rede vira médico da UPA só dentro do passo.
INSERT INTO _r (txt)
SELECT e2e.fb(p.n, 'FB.7.nir_abre_com_medico', 'nir', 'NIR abre o pedido em nome do médico assistente (outra pessoa; desfeito)',
  format($q$SELECT e2e.fb_confere((d ->> 'numero') IS NOT NULL, 'aberto pelo NIR: nº ' || (d ->> 'numero'))
    FROM (SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) d) z$q$, e2e.fb_upa(), e2e.fbu(p.n, 'pac'),
    p.d || jsonb_build_object('medico_assistente_id', (SELECT id FROM public.perfis WHERE id <> e2e.fb_login() ORDER BY id LIMIT 1))), 'ok', NULL, true, 'int',
  format($q$INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo) SELECT id, %L, 'plantonista', true FROM public.perfis WHERE id <> e2e.fb_login() ORDER BY id LIMIT 1$q$, e2e.fb_upa()))
  FROM _ped p WHERE p.n = 8;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.7.enviada', 'banco', 'Pedido enviado à Central da rede, modalidade 04, com evento e auditoria',
  format($q$SELECT e2e.fb_guardar_numero(%L, s.numero) || e2e.fb_confere(s.status = 'enviada' AND s.modalidade = '04' AND s.central_id = e2e.fb_central() AND s.solicitante_papel = %L
      AND s.medico_assistente_id = e2e.fb_login() AND s.isolamento = %L::boolean AND s.isolamento_tipo IS NOT DISTINCT FROM %L
      AND EXISTS (SELECT 1 FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id AND e.evento = 'enviada')
      AND EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.acao = 'regulacao_solicitada' AND a.entidade_id = s.id),
      'nº ' || s.numero || ', ' || s.status || ', ' || s.tipo_leito || ', ' || s.prioridade || ', isolamento ' || coalesce(s.isolamento_tipo, 'não') || ', papel ' || s.solicitante_papel)
    FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, c.n, 'medico', c.iso_tipo IS NOT NULL, c.iso_tipo, e2e.fbu(c.n, 'reg')),
  'ok', NULL, false, 'reg')
  FROM e2e.fb_coorte c ORDER BY c.n;

-- situação e agente do isolamento (a tela grava depois do envio)
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.7.isolamento_situacao', 'med', 'Situação (' || c.iso_sit || ') e agente do isolamento ' || c.iso_tipo,
  format('SELECT public.regulacao_definir_isolamento(%L::uuid, %L, %L, %L)::text', e2e.fbu(c.n, 'reg'), c.iso_tipo, c.iso_sit, c.iso_agente), 'ok', 'reg_iso', false, 'reg')
  FROM e2e.fb_coorte c WHERE c.iso_tipo IS NOT NULL ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.7.isolamento_' || x.passo, x.papel, x.descricao,
  format('SELECT public.regulacao_definir_isolamento(%L::uuid, %L, %L, %L)::text', e2e.fbu(c.n, 'reg'), x.tipo, x.sit, x.agente), x.esperado, NULL, true, 'reg',
  CASE WHEN x.outro THEN format('UPDATE public.regulacao_solicitacoes SET solicitante_id = (SELECT id FROM public.perfis WHERE id <> e2e.fb_login() ORDER BY id LIMIT 1), medico_assistente_id = NULL WHERE id = %L', e2e.fbu(c.n, 'reg')) END)
  FROM e2e.fb_coorte c CROSS JOIN (VALUES
    (1, 'tirar_de_paciente_marcado', 'med', 'Tirar o isolamento do pedido de paciente marcado em isolamento no atendimento: deve recusar', NULL, NULL, NULL, 'erro:a regulação não pode tirar o isolamento', false),
    (2, 'tipo_invalido', 'med', 'Tipo que não existe: deve recusar', 'respiratorio', 'suspeito', 'x', 'erro:Tipo de isolamento', false),
    (3, 'situacao_invalida', 'med', 'Situação que não existe: deve recusar', 'aerossol', 'provavel', 'x', 'erro:Situação do isolamento', false),
    (4, 'nir_outro_solicitante', 'nir', 'NIR (pedido de outro médico) tenta mudar o isolamento: deve recusar', 'contato', 'suspeito', 'teste', 'erro:O isolamento do pedido é definido por quem pede', true),
    (5, 'enfermeiro', 'enf', 'Enfermeiro (pedido de outro médico) tenta mudar o isolamento: deve recusar', 'contato', 'suspeito', 'teste', 'erro', true),
    (6, 'outro_medico', 'med', 'Outro médico da unidade (não o solicitante) muda o isolamento (registro; desfeito)', 'contato', 'suspeito', 'teste', 'registrar', true),
    (7, 'regulador', 'reg', 'Médico regulador da central muda o isolamento (permitido; desfeito)', 'contato_aerossol', 'confirmado', 'teste do regulador', 'ok', false)
  ) x(o, passo, papel, descricao, tipo, sit, agente, esperado, outro)
 WHERE c.n = 2 ORDER BY x.o;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.7.isolamento_banco', 'banco', 'Isolamento do pedido: tipo, situação e agente gravados, com evento isolamento_alterado',
  format($q$SELECT e2e.fb_confere(s.isolamento AND s.isolamento_tipo = %L AND s.isolamento_situacao = %L AND s.isolamento_agente = %L
      AND EXISTS (SELECT 1 FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id AND e.evento = 'isolamento_alterado'),
      s.isolamento_tipo || ' / ' || s.isolamento_situacao || ' / ' || s.isolamento_agente) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$,
    c.iso_tipo, c.iso_sit, c.iso_agente, e2e.fbu(c.n, 'reg')), 'ok', NULL, false, 'reg_iso')
  FROM e2e.fb_coorte c WHERE c.iso_tipo IS NOT NULL ORDER BY c.n;

-- duplicidade e leitura pela origem
INSERT INTO _r (txt)
SELECT e2e.fb(p.n, 'FB.7.duplicidade', 'med', 'Ação repetida: segundo pedido igual para o mesmo paciente: aceita com aviso de duplicidade (desfeito)',
  format($q$SELECT e2e.fb_confere((x ->> 'aviso_duplicidade')::boolean, x::text) FROM (SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) x) z$q$,
    e2e.fb_upa(), e2e.fbu(p.n, 'pac'), p.d), 'ok', NULL, true, 'reg')
  FROM _ped p WHERE p.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.7.lista_origem', x.papel, 'A origem (' || x.papel || ') vê os 10 pedidos na lista da unidade',
  format($q$SELECT e2e.fb_confere(count(*) = 10, count(*) || ' dos 10 pedidos B na lista') FROM unnest(%L::text[]) i, (SELECT public.regulacao_lista(%L::uuid)::text l) z
    WHERE z.l LIKE '%%' || i || '%%'$q$, (SELECT array_agg(e2e.fbv(c.n, 'reg')) FROM e2e.fb_coorte c), e2e.fb_upa()), 'ok')
  FROM (VALUES ('med'), ('nir'), ('ges')) x(papel);
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.7.lista_origem_enfermeiro', x.papel, 'Perfil sem acesso à regulação (' || x.papel || ') tenta ler a lista da unidade: deve recusar',
  format('SELECT left(public.regulacao_lista(%L::uuid)::text, 100)', e2e.fb_upa()), 'erro')
  FROM (VALUES ('enf'), ('rec'), ('tec')) x(papel);

-- o médico anexa ao pedido o documento de exames do prontuário
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.7.anexar_documento', 'med', 'Médico anexa ao pedido o pedido de exames emitido (documento do prontuário)',
  format('SELECT left(public.regulacao_anexar_documento(%L::uuid, %L::uuid)::text, 150)', e2e.fbu(c.n, 'reg'), e2e.fbu(c.n, 'doc_exames')), 'ok', 'anexo', false, 'reg,doc_exames')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 2, 6) ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.7.anexar_documento_de_outro', 'med', 'Anexar documento de outro paciente: deve recusar',
  format('SELECT left(public.regulacao_anexar_documento(%L::uuid, %L::uuid)::text, 150)', e2e.fbu(c.n, 'reg'), e2e.fbu(1, 'doc_exames')), 'erro', NULL, false, 'reg')
  FROM e2e.fb_coorte c WHERE c.n = 3;

SELECT txt FROM _r ORDER BY o;
--FIM
COMMIT;
