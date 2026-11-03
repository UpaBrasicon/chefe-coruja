-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270217000001_contrarreferencia_ubs.sql (5A, tarefa 6,
-- parte 6.1). Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. enviado pela UBS (sem CNS): a alta na UPA volta à UBS que enviou, com o
--    CID, o registro, a orientação à UBS e o número do envio;
-- 2. foi à UPA por conta própria: a evasão volta às UBS da rede onde ele tem
--    cadastro pelo CNS; a UBS de outra rede não recebe;
-- 3. o fim da consulta na própria UBS não gera retorno;
-- 4. alta da internação gera; alta desfeita cancela;
-- 5. avisos a médico, enfermeiro e gestor (a recepção não); a lista é de todos
--    da UBS, sem o resumo; o resumo abre para médico e enfermeiro, registra o
--    acesso na unidade de origem e marca "visto"; outra UBS não abre.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000059a1'),
  ('org2', '00000000-0000-4000-8000-0000000059a2'),
  ('ubs',  '00000000-0000-4000-8000-0000000059a3'),
  ('ubs2', '00000000-0000-4000-8000-0000000059a4'),
  ('ubs3', '00000000-0000-4000-8000-0000000059a5'),
  ('upa',  '00000000-0000-4000-8000-0000000059a6'),
  ('cons', '00000000-0000-4000-8000-0000000059a7'),
  ('porta','00000000-0000-4000-8000-0000000059a8'),
  ('med',  '00000000-0000-4000-8000-0000000059b1'),
  ('enf',  '00000000-0000-4000-8000-0000000059b2'),
  ('rec',  '00000000-0000-4000-8000-0000000059b3'),
  ('medu', '00000000-0000-4000-8000-0000000059b4'),
  ('recu', '00000000-0000-4000-8000-0000000059b5'),
  ('med2', '00000000-0000-4000-8000-0000000059b6');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
-- retorno de um episódio ou internação para uma UBS (leitura da tabela no teste)
CREATE FUNCTION pg_temp.cr(p_origem uuid, p_ubs uuid) RETURNS public.contrarreferencias LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.contrarreferencias WHERE (episodio_id = p_origem OR internacao_id = p_origem) AND unidade_ubs_id = p_ubs
   ORDER BY criado_em DESC LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION pg_temp.cr(uuid, uuid) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a6.local' FROM ids WHERE nome IN ('med', 'enf', 'rec', 'medu', 'recu', 'med2');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'enf', 'rec', 'medu', 'recu', 'med2')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do 5A6'), (pg_temp.id('org2'), 'Outra rede do 5A6');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do 5A6', 'ubs'),
  (pg_temp.id('ubs2'), pg_temp.id('org'), 'UBS Dois do 5A6', 'ubs'),
  (pg_temp.id('ubs3'), pg_temp.id('org2'), 'UBS de outra rede', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do 5A6', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio'),
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('medu'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('recu'), pg_temp.id('upa'), 'recepcao'), (pg_temp.id('med2'), pg_temp.id('ubs2'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT u, s, pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), 'med'), (pg_temp.id('ubs'), pg_temp.id('cons'), 'rec'),
               (pg_temp.id('upa'), pg_temp.id('porta'), 'medu'), (pg_temp.id('upa'), pg_temp.id('porta'), 'recu')) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('ubs'), pg_temp.id('upa')) ON CONFLICT DO NOTHING;

-- cadastro do mesmo paciente (CNS) em outra UBS da rede e numa UBS de outra rede
INSERT INTO public.pacientes (unidade_id, nome, data_nascimento, cns) VALUES
  (pg_temp.id('ubs2'), 'Paciente Retorno Um', '1958-03-03', '898001160000001'),
  (pg_temp.id('ubs3'), 'Paciente Retorno Um', '1958-03-03', '898001160000001');

SET LOCAL ROLE authenticated;

-- ── fichas na UBS ───────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep1', (public.registrar_ficha(pg_temp.id('cons'), 'Renovar receita', NULL,
  '{"nome":"Paciente Retorno Um","data_nascimento":"1958-03-03","cns":"898001160000001","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'ep2', (public.registrar_ficha(pg_temp.id('cons'), 'Falta de ar', NULL,
  '{"nome":"Paciente Retorno Dois","data_nascimento":"1990-04-04","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;

-- ── 1. enviado pela UBS, alta na UPA ────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('ep2'));
INSERT INTO v SELECT 'x2', public.encaminhar_upa(pg_temp.v('ep2'), pg_temp.id('upa'), 'Crise de asma sem resposta ao broncodilatador');
SELECT pg_temp.como('recu');
INSERT INTO v SELECT 'epu2', (public.registrar_ficha(pg_temp.id('porta'), 'Falta de ar (vindo da UBS)', NULL,
  '{"nome":"Paciente Retorno Dois","data_nascimento":"1990-04-04"}') ->> 'episodio_id')::uuid;
SELECT public.encaminhamento_upa_marcar_chegada(pg_temp.v('x2'), true, pg_temp.v('epu2'));
RESET ROLE;
INSERT INTO v SELECT 'p2', paciente_id FROM public.episodios WHERE id = pg_temp.v('ep2');
-- a classificação de risco não é o assunto daqui: o paciente vai direto ao médico
UPDATE public.episodios SET etapa = 'atendimento' WHERE id = pg_temp.v('epu2');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('medu');
SELECT public.iniciar_atendimento(pg_temp.v('epu2'));
SELECT public.registrar_soap(pg_temp.v('epu2'), 'Dispneia', 'Sibilos difusos', 'Crise de asma moderada, melhorou com nebulização',
  'Alta com corticoide oral', 'J45.9');
SELECT public.registrar_desfecho(pg_temp.v('epu2'), 'alta', NULL,
  '{"cid_alta":"J45.9","orientacao_ubs":"Reavaliar a asma em 7 dias e ajustar o controle"}');
RESET ROLE;
SELECT pg_temp.ok((SELECT c.desfecho = 'alta' AND c.situacao = 'a_ver' AND c.encaminhamento_upa_id = pg_temp.v('x2')
                          AND c.orientacao = 'Reavaliar a asma em 7 dias e ajustar o controle'
                          AND c.resumo ->> 'cid' = 'J45.9' AND c.resumo -> 'registro' ->> 'plano' = 'Alta com corticoide oral'
                          AND c.paciente_ubs_id = pg_temp.v('p2')
                     FROM pg_temp.cr(pg_temp.v('epu2'), pg_temp.id('ubs')) c),
  'alta na UPA volta à UBS que enviou, com CID, registro, orientação e o envio');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.contrarreferencias WHERE episodio_id = pg_temp.v('epu2')), 'só a UBS que enviou (sem CNS)');

-- ── 2. foi por conta própria: evasão volta pelo CNS ─────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('recu');
INSERT INTO v SELECT 'epu1', (public.registrar_ficha(pg_temp.id('porta'), 'Dor de cabeça', NULL,
  '{"nome":"Paciente Retorno Um","data_nascimento":"1958-03-03","cns":"898001160000001"}') ->> 'episodio_id')::uuid;
SELECT public.retirar_da_fila(pg_temp.v('epu1'), 'evasao', 'saiu da sala de espera sem avisar a recepção');
RESET ROLE;
SELECT pg_temp.ok((pg_temp.cr(pg_temp.v('epu1'), pg_temp.id('ubs'))).id IS NOT NULL AND (pg_temp.cr(pg_temp.v('epu1'), pg_temp.id('ubs2'))).id IS NOT NULL,
  'evasão volta às duas UBS da rede onde ele tem cadastro');
SELECT pg_temp.ok((pg_temp.cr(pg_temp.v('epu1'), pg_temp.id('ubs3'))).id IS NULL, 'a UBS de outra rede não recebe');
SELECT pg_temp.ok((SELECT encaminhamento_upa_id IS NULL AND desfecho = 'evasao' FROM pg_temp.cr(pg_temp.v('epu1'), pg_temp.id('ubs')) c),
  'sem envio ligado, desfecho evasão');

-- ── 3. a consulta da própria UBS não gera ───────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
SELECT public.retirar_da_fila(pg_temp.v('ep1'), 'evasao', 'saiu antes da consulta, sem avisar ninguém');
RESET ROLE;
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.contrarreferencias WHERE episodio_id = pg_temp.v('ep1')), 'o fim da consulta na UBS não gera retorno');

-- ── 4. internação: alta gera, alta desfeita cancela ─────────────────────────
WITH n AS (
  INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, tipo_internacao, origem_admissao, status, data_admissao)
  SELECT pg_temp.id('org'), pg_temp.id('upa'), paciente_id, 'urgencia', 'emergencia', 'internado', now() - interval '2 days'
    FROM public.episodios WHERE id = pg_temp.v('epu1')
  RETURNING id)
INSERT INTO v SELECT 'int1', id FROM n;
UPDATE public.internacoes SET status = 'alta_melhorada', data_alta = now(), cid_alta = 'I10', alta_por = pg_temp.id('medu'),
       alta_observacoes = 'Pressão controlada', alta_detalhes = '{"orientacao_ubs":"Acompanhar a pressão na UBS"}'
 WHERE id = pg_temp.v('int1');
SELECT pg_temp.ok((SELECT c.situacao = 'a_ver' AND c.desfecho = 'alta_melhorada' AND c.orientacao = 'Acompanhar a pressão na UBS'
                          AND c.resumo ->> 'relato' = 'Pressão controlada' FROM pg_temp.cr(pg_temp.v('int1'), pg_temp.id('ubs')) c),
  'alta da internação gera o retorno');
UPDATE public.internacoes SET status = 'internado', data_alta = NULL WHERE id = pg_temp.v('int1');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.contrarreferencias WHERE internacao_id = pg_temp.v('int1') AND situacao = 'cancelada'),
  'alta desfeita cancela o retorno (nas duas UBS)');

-- ── 5. avisos, lista e leitura ──────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) >= 3 FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('med') AND tipo LIKE 'ubs_retorno_%')
                  AND EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('enf') AND tipo LIKE 'ubs_retorno_%'
                                 AND mensagem LIKE 'Paciente Retorno Dois: alta na UPA do 5A6 em %Há orientação à UBS.'),
  'médico e enfermeiro da UBS são avisados');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('rec') AND tipo LIKE 'ubs_retorno_%'),
  'a recepção não é avisada');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
SELECT pg_temp.ok((SELECT jsonb_array_length(l) = 2 AND NOT (l -> 0 ? 'resumo') FROM public.contrarreferencias_da_unidade(pg_temp.id('ubs')) l),
  'a recepção vê os dois retornos, sem o resumo');
SELECT pg_temp.falha(format('SELECT public.contrarreferencia_abrir(%L)', (pg_temp.cr(pg_temp.v('epu2'), pg_temp.id('ubs'))).id),
  'O resumo do retorno é visto', 'a recepção não abre o resumo');
SELECT pg_temp.como('med2');
SELECT pg_temp.ok(jsonb_array_length(public.contrarreferencias_da_unidade(pg_temp.id('ubs2'))) = 1, 'a outra UBS vê o retorno dela');
SELECT pg_temp.falha(format('SELECT public.contrarreferencia_abrir(%L)', (pg_temp.cr(pg_temp.v('epu2'), pg_temp.id('ubs'))).id),
  'O resumo do retorno é visto', 'outra UBS não abre o retorno desta');
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((SELECT r -> 'resumo' ->> 'unidade' = 'UPA do 5A6' AND r ->> 'orientacao' LIKE 'Reavaliar a asma%' AND (r ->> 'encaminhamento_numero') IS NOT NULL
                     FROM public.contrarreferencia_abrir((pg_temp.cr(pg_temp.v('epu2'), pg_temp.id('ubs'))).id) r),
  'o enfermeiro abre o resumo com a orientação');
SELECT pg_temp.ok((SELECT e ->> 'situacao' = 'visto' AND e ->> 'visto_por' = 'Pessoa enf'
                     FROM jsonb_array_elements(public.contrarreferencias_do_paciente(pg_temp.v('p2'))) e),
  'abrir marca visto; o retorno aparece no paciente da UBS');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE acessado_por = pg_temp.id('enf') AND unidade_id = pg_temp.id('upa')),
  'abrir registra o acesso no prontuário da UPA');
SELECT pg_temp.ok(has_table_privilege('authenticated', 'public.contrarreferencias', 'SELECT') IS FALSE, 'sem acesso direto à tabela');

ROLLBACK;
