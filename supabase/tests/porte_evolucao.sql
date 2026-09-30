-- Testes da evolução estruturada, do resumo clínico e do histórico
-- multiprofissional (migration 20261004000006). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_evolucao.sql
-- Regras: uma evolução por dia por profissional (a segunda vira complemento),
-- texto montado no servidor a partir do JSON, correção estruturada vira versão
-- nova com o JSON novo, quem registra cada tipo, SV da enfermagem, resumo com
-- antibiótico e dia de uso, medicações da prescrição vigente, eletrólitos,
-- condutas, histórico com autor e especialidade, nada se apaga.
BEGIN;
-- médico (…0002) no PS e na Observação; enfermeira (…0004) no PS e na
-- Observação; recepção (…0005) no PS.
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002']::uuid[]) s,
     unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004']::uuid[]) p;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.leitos (setor_id, identificador, tipo) VALUES ('22000000-0000-4000-8000-000000000002', 'Box Evol', 'observacao');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok;
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';

-- ── paciente chega, é triado, atendido e fica em observação ─────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL, '{"nome":"Porte Evolucao","data_nascimento":"1970-01-01"}') ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  pg_temp.u('flx'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep')), public.registrar_soap(pg_temp.u('ep'), 'queixa', 'exame', 'avaliacao', 'plano', 'R60');
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'observacao');
RESET ROLE;
INSERT INTO t SELECT 'i', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('ep');
INSERT INTO t SELECT 'p', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');

-- prescrição da internação: antibiótico iniciado há 2 dias, dipirona e reposição de K
WITH x AS (
  INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status, internacao_id, criada_por)
  VALUES ('21000000-0000-4000-8000-000000000001', pg_temp.u('p'), '10000000-0000-4000-8000-000000000002', 'ativa', pg_temp.u('i'),
          '10000000-0000-4000-8000-000000000002') RETURNING id)
INSERT INTO t SELECT 'presc', id::text FROM x;
WITH x AS (
  INSERT INTO public.prescricao_itens (prescricao_id, descricao, dose, via, posologia, ordem, created_at, autor_id)
  VALUES (pg_temp.u('presc'), 'Ceftriaxona', '1 g', 'IV', '12/12h', 1, now() - interval '2 days', '10000000-0000-4000-8000-000000000002')
  RETURNING id)
INSERT INTO t SELECT 'atb', id::text FROM x;
INSERT INTO public.prescricao_itens (prescricao_id, descricao, dose, via, posologia, ordem, autor_id, se_necessario) VALUES
  (pg_temp.u('presc'), 'Dipirona', '1 g', 'IV', '6/6h', 2, '10000000-0000-4000-8000-000000000002', true),
  (pg_temp.u('presc'), 'Cloreto de potássio 19,1%', '10 mL', 'IV', 'em 500 mL SF, 4 h', 3, '10000000-0000-4000-8000-000000000002', false);
-- sinais vitais da enfermagem e um potássio
INSERT INTO public.observacao (unidade_id, paciente_id, internacao_id, conceito_id, valor_num, valor_conceito_id, aferido_em, registrado_por)
SELECT '21000000-0000-4000-8000-000000000001', pg_temp.u('p'), pg_temp.u('i'), c.id, x.n,
       (SELECT o.id FROM public.conceito_opcao o WHERE o.conceito_id = c.id AND o.valor = x.cod), clock_timestamp(),
       '10000000-0000-4000-8000-000000000004'
FROM (VALUES ('pressao-arterial-sistolica', 118, NULL), ('pressao-arterial-diastolica', 76, NULL), ('frequencia-cardiaca', 84, NULL),
             ('frequencia-respiratoria', 17, NULL), ('temperatura', 36.8, NULL), ('saturacao-o2', 96, NULL),
             ('oxigenio-suplementar', NULL, 'ar'), ('potassio', 3.2, NULL)) x(nome, n, cod)
JOIN public.conceito c ON c.nome = x.nome AND c.unidade_id IS NULL;

-- ── tipos novos na CHECK, sem desfazer os anteriores ────────────────────────
DO $$ DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint WHERE conname = 'documentos_clinicos_tipo_documento_check';
  IF v_def NOT LIKE '%evolucao_enfermagem%' OR v_def NOT LIKE '%anotacao_enfermagem%' OR v_def NOT LIKE '%evolucao_fisioterapia%'
     OR v_def NOT LIKE '%evolucao_nutricao%' OR v_def NOT LIKE '%evolucao_outros%'
     OR v_def NOT LIKE '%teleinterconsulta%' OR v_def NOT LIKE '%laudo_aih%' OR v_def NOT LIKE '%''evolucao''%' THEN
    RAISE EXCEPTION 'FALHOU: CHECK de tipos (%)', v_def;
  END IF;
  RAISE NOTICE 'OK  cinco tipos novos na CHECK, os anteriores seguem';
  IF has_function_privilege('anon', 'public.registrar_evolucao(uuid, text, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.historico_evolucoes(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.registrar_resumo_clinico(uuid, text, text, jsonb)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.evolucoes_estruturadas', 'INSERT')
     OR has_table_privilege('authenticated', 'public.resumos_clinicos', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHOU: permissões';
  END IF;
  RAISE NOTICE 'OK  anon não executa; ninguém escreve direto nas tabelas novas';
END $$;

-- ── contexto do formulário ──────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'ctx', public.contexto_evolucao(pg_temp.u('i'))::text;
RESET ROLE;
DO $$ DECLARE c jsonb := pg_temp.v('ctx')::jsonb;
BEGIN
  IF (c ->> 'dih')::int <> 1 OR NOT (c ->> 'pode_registrar')::boolean OR c -> 'minha_do_dia' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: contexto básico (%)', c;
  END IF;
  IF jsonb_array_length(c -> 'antimicrobianos') <> 1 OR (c #>> '{antimicrobianos,0,dia}')::int <> 3
     OR c #>> '{antimicrobianos,0,nome}' NOT LIKE 'Ceftriaxona 1 g IV 12/12h' THEN
    RAISE EXCEPTION 'FALHOU: antimicrobiano da prescrição com dia de uso (%)', c -> 'antimicrobianos';
  END IF;
  RAISE NOTICE 'OK  contexto traz DIH e o antimicrobiano da prescrição no D3 (dipirona e KCl fora)';
  IF c #>> '{sv_enfermagem,pa}' <> '118x76' OR c #>> '{sv_enfermagem,temp}' <> '36,8' OR c #>> '{sv_enfermagem,condicao}' <> 'ar'
     OR c #>> '{sv_enfermagem,por}' <> 'Enfermeira de Teste' THEN
    RAISE EXCEPTION 'FALHOU: SV da enfermagem (%)', c -> 'sv_enfermagem';
  END IF;
  RAISE NOTICE 'OK  "Trazer SV da enfermagem": PA, temperatura com vírgula, ar ambiente e quem aferiu';
END $$;

-- ── evolução médica estruturada ─────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_evolucao(%L, %L, NULL, %L)', pg_temp.v('i'), 'evolucao',
  '{"formato":"evolucao_medica_v1","s":"","a":"","p":""}'), 'Escreva a evolução', 'estruturada exige S, A ou P');
SELECT pg_temp.falha(format('SELECT public.registrar_evolucao(%L, %L, NULL, %L)', pg_temp.v('i'), 'evolucao',
  '{"formato":"evolucao_medica_v1","s":"Sem queixas novas hoje","sv_condicao":"cpap"}'), 'SpO₂: informe', 'condição da SpO₂ conferida');
INSERT INTO t SELECT 'e1', public.registrar_evolucao(pg_temp.u('i'), 'evolucao', NULL, jsonb_build_object(
  'formato', 'evolucao_medica_v1', 'dih', 1, 'alergias', 'Nega alergias',
  'problemas', E'Edema de face (R60)\nHipertensão arterial sistêmica',
  'antimicrobianos', jsonb_build_array(jsonb_build_object('nome', 'Ceftriaxona 1 g IV 12/12h', 'inicio', (private.data_atual() - 2)::text)),
  's', 'Refere melhora do inchaço, dormiu bem.',
  'sv', jsonb_build_object('pa', '118x76', 'fc', '84', 'temp', '36,8', 'spo2', '96'), 'sv_condicao', 'ar',
  'exame_fisico', jsonb_build_object('geral', 'Corado, hidratado', 'acv', 'RCR 2T sem sopros'),
  'a', 'Edema em regressão com antibiótico.', 'p', 'Manter ceftriaxona até D7; reavaliar alta em 48 h.',
  'cid', jsonb_build_object('codigo', 'R60', 'descricao', 'Edema', 'estado', 'hipotese')));
-- a segunda do dia vira complemento
INSERT INTO t SELECT 'e2', public.registrar_evolucao(pg_temp.u('i'), 'evolucao', 'Febre de 38,2 às 15h; colhidas hemoculturas.');
-- enfermeira não registra evolução médica; registra a de enfermagem e anotações
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.registrar_evolucao(%L, %L, %L)', pg_temp.v('i'), 'evolucao', 'Evolução médica pela enfermeira'),
  'Acesso negado: este tipo', 'evolução médica é do médico');
INSERT INTO t SELECT 'enf1', public.registrar_evolucao(pg_temp.u('i'), 'evolucao_enfermagem', 'Noite sem intercorrências, acesso pérvio.');
INSERT INTO t SELECT 'enf2', public.registrar_evolucao(pg_temp.u('i'), 'evolucao_enfermagem', 'Paciente febril às 15h, médico avisado.');
INSERT INTO t SELECT 'an1', public.registrar_evolucao(pg_temp.u('i'), 'anotacao_enfermagem', 'Aferidos sinais vitais conforme aprazamento.');
INSERT INTO t SELECT 'an2', public.registrar_evolucao(pg_temp.u('i'), 'anotacao_enfermagem', 'Diurese espontânea, 300 mL.');
SELECT pg_temp.falha(format('SELECT public.registrar_evolucao(%L, %L, %L)', pg_temp.v('i'), 'evolucao_fisioterapia', 'Exercícios respiratórios feitos.'),
  'Esta categoria profissional ainda não tem papel', 'fisioterapia: tipo pronto, registro fechado sem papel');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_evolucao(%L, %L, %L)', pg_temp.v('i'), 'anotacao_enfermagem', 'Anotação feita pelo médico'),
  'Acesso negado: este tipo', 'anotação de enfermagem é da enfermagem');
RESET ROLE;
DO $$
DECLARE d public.documentos_clinicos; e public.evolucoes_estruturadas;
BEGIN
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = pg_temp.u('e1');
  SELECT * INTO e FROM public.evolucoes_estruturadas WHERE documento_id = d.id;
  IF d.tipo_documento <> 'evolucao' OR e.papel <> 'do_dia' OR e.dia <> private.data_atual()
     OR e.dados ->> 'formato' <> 'evolucao_medica_v1' OR e.autor_id <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: evolução do dia (%, %)', d.tipo_documento, e;
  END IF;
  IF d.conteudo NOT LIKE 'EVOLUÇÃO MÉDICA · D1%' OR d.conteudo NOT LIKE '%S: Refere melhora%'
     OR d.conteudo NOT LIKE '%PA 118x76 mmHg · FC 84 bpm · Temp. 36,8 °C · SpO₂ 96% em ar ambiente%'
     OR d.conteudo NOT LIKE '%- Ceftriaxona 1 g IV 12/12h · D3 (início%' OR d.conteudo NOT LIKE '%- ACV: RCR 2T sem sopros%'
     OR d.conteudo NOT LIKE '%P: Manter ceftriaxona%' OR d.conteudo NOT LIKE '%CID-10): R60 — Edema (hipótese)%'
     OR d.conteudo_hash <> encode(sha256(convert_to(d.conteudo, 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'FALHOU: texto montado no servidor: %', d.conteudo;
  END IF;
  RAISE NOTICE 'OK  evolução estruturada vira documento "evolucao" com o texto montado do JSON e o hash do texto';
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = pg_temp.u('e2');
  SELECT * INTO e FROM public.evolucoes_estruturadas WHERE documento_id = d.id;
  IF e.papel <> 'complemento' OR e.complemento_de <> pg_temp.u('e1') OR d.conteudo NOT LIKE 'COMPLEMENTO à evolução de %'
     OR d.documento_raiz_id = pg_temp.u('e1') THEN
    RAISE EXCEPTION 'FALHOU: segunda do dia (%, %)', e, d.conteudo;
  END IF;
  RAISE NOTICE 'OK  a segunda evolução do dia do mesmo médico entra como complemento da primeira';
  IF (SELECT papel FROM public.evolucoes_estruturadas WHERE documento_id = pg_temp.u('enf1')) <> 'do_dia'
     OR (SELECT papel FROM public.evolucoes_estruturadas WHERE documento_id = pg_temp.u('enf2')) <> 'complemento'
     OR (SELECT papel FROM public.evolucoes_estruturadas WHERE documento_id = pg_temp.u('an2')) <> 'anotacao' THEN
    RAISE EXCEPTION 'FALHOU: regra do dia por tipo';
  END IF;
  RAISE NOTICE 'OK  a regra do dia vale por tipo; anotações de enfermagem não têm limite diário';
END $$;

-- ── correção ────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.corrigir_evolucao(%L, %L, %L)', pg_temp.v('e1'), 'Texto livre que não bate com o JSON', 'justificativa longa o bastante'),
  'Esta evolução é estruturada', 'estruturada se corrige pelo formulário');
INSERT INTO t SELECT 'e1b', public.corrigir_evolucao(pg_temp.u('e1'), NULL, 'lista de problemas incompleta',
  (SELECT dados || '{"problemas":"Edema de face (R60)\nHipertensão arterial sistêmica\nDiabetes tipo 2"}'::jsonb
     FROM public.evolucoes_estruturadas WHERE documento_id = pg_temp.u('e1')));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.corrigir_evolucao(%L, %L, %L)', pg_temp.v('e2'), 'Complemento alterado por outra pessoa', 'justificativa bem longa'),
  'Só o autor corrige', 'só o autor corrige');
RESET ROLE;
DO $$
DECLARE d public.documentos_clinicos; e public.evolucoes_estruturadas;
BEGIN
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = pg_temp.u('e1b');
  SELECT * INTO e FROM public.evolucoes_estruturadas WHERE documento_id = d.id;
  IF d.versao <> 2 OR d.documento_raiz_id <> pg_temp.u('e1') OR d.conteudo NOT LIKE '%Diabetes tipo 2%'
     OR e.versao <> 2 OR e.papel <> 'do_dia' OR e.dados ->> 'problemas' NOT LIKE '%Diabetes%'
     OR (SELECT estado FROM public.documentos_clinicos WHERE id = pg_temp.u('e1')) <> 'retificado' THEN
    RAISE EXCEPTION 'FALHOU: correção estruturada (%, %)', d.versao, e;
  END IF;
  RAISE NOTICE 'OK  correção estruturada vira versão 2 com o JSON novo e a anterior fica retificada';
END $$;

-- ── resumo clínico ──────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.registrar_resumo_clinico(%L, %L)', pg_temp.v('i'), 'Resumo escrito pela enfermagem'),
  'Acesso negado: o resumo clínico é do médico', 'resumo clínico é do médico');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_resumo_clinico(%L, %L, NULL, %L)', pg_temp.v('i'), 'Edema de face em regressão.',
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.v('atb'), 'movimento', 'descalonado'))),
  'Diga por que', 'descalonar exige motivo');
SELECT pg_temp.falha(format('SELECT public.registrar_resumo_clinico(%L, %L, NULL, %L)', pg_temp.v('i'), 'Edema de face em regressão.',
  jsonb_build_array(jsonb_build_object('item_id', gen_random_uuid(), 'movimento', 'mantido'))),
  'Antibiótico fora da prescrição', 'antibiótico tem de ser desta internação');
SELECT public.registrar_resumo_clinico(pg_temp.u('i'), 'Edema de face há 2 dias, em regressão.', 'Provável em 48 h.',
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.v('atb'), 'movimento', 'descalonado', 'motivo', 'Cultura sem germe resistente.')));
INSERT INTO t SELECT 'res', public.resumo_clinico(pg_temp.u('i'))::text;
RESET ROLE;
DO $$ DECLARE r jsonb := pg_temp.v('res')::jsonb;
BEGIN
  IF r #>> '{resumo,texto}' <> 'Edema de face há 2 dias, em regressão.' OR r #>> '{resumo,previsao_alta}' <> 'Provável em 48 h.'
     OR r #>> '{resumo,autor}' <> 'Plantonista de Teste' THEN
    RAISE EXCEPTION 'FALHOU: resumo (%)', r -> 'resumo';
  END IF;
  IF jsonb_array_length(r -> 'antibioticos') <> 1 OR (r #>> '{antibioticos,0,dia}')::int <> 3
     OR r #>> '{antibioticos,0,movimento}' <> 'descalonado' OR NOT (r #>> '{antibioticos,0,em_curso}')::boolean THEN
    RAISE EXCEPTION 'FALHOU: antibiótico do resumo (%)', r -> 'antibioticos';
  END IF;
  RAISE NOTICE 'OK  resumo com previsão de alta e antibiótico no D3 com movimento e motivo';
  IF jsonb_array_length(r -> 'medicacoes') <> 2 OR NOT (r -> 'medicacoes') @> '[{"nome":"Dipirona 1 g","via":"IV · 6/6h · se necessário"}]'
     OR NOT (r -> 'medicacoes') @> '[{"reposicao":true}]' THEN
    RAISE EXCEPTION 'FALHOU: medicações em curso (%)', r -> 'medicacoes';
  END IF;
  RAISE NOTICE 'OK  medicações em curso vêm da prescrição vigente, sem o antibiótico';
  IF NOT (r -> 'eletrolitos') @> '[{"nome":"potassio","valor":"3,2"}]' OR jsonb_array_length(r -> 'reposicoes') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: eletrólitos e reposição (%, %)', r -> 'eletrolitos', r -> 'reposicoes';
  END IF;
  RAISE NOTICE 'OK  eletrólitos da internação e reposição prescrita';
  IF jsonb_array_length(r -> 'condutas') <> 1 OR r #>> '{condutas,0,texto}' NOT LIKE 'Manter ceftriaxona%' THEN
    RAISE EXCEPTION 'FALHOU: condutas (%)', r -> 'condutas';
  END IF;
  RAISE NOTICE 'OK  condutas saem do P das evoluções estruturadas vigentes';
END $$;

-- ── histórico multiprofissional ─────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'hist', public.historico_evolucoes(pg_temp.u('i'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.historico_evolucoes(%L)', pg_temp.v('i')), 'Acesso negado', 'recepção de outro setor não lê o histórico');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'ctx2', public.contexto_evolucao(pg_temp.u('i'))::text;
RESET ROLE;
DO $$ DECLARE h jsonb := pg_temp.v('hist')::jsonb; c jsonb := pg_temp.v('ctx2')::jsonb;
BEGIN
  IF jsonb_array_length(h) <> 6
     OR NOT h @> jsonb_build_array(jsonb_build_object('raiz_id', pg_temp.v('e1'), 'versao', 2, 'tipo', 'evolucao', 'autor', 'Plantonista de Teste',
                                                     'especialidade', 'Médica', 'papel', 'do_dia', 'estruturada', true))
     OR NOT h @> '[{"tipo":"anotacao_enfermagem","especialidade":"Enfermagem","autor":"Enfermeira de Teste"}]'
     OR NOT h @> '[{"tipo":"evolucao","papel":"complemento"}]' THEN
    RAISE EXCEPTION 'FALHOU: histórico (%)', h;
  END IF;
  RAISE NOTICE 'OK  histórico: versão vigente de cada registro, autor original, especialidade e papel no dia';
  IF c #>> '{minha_do_dia,raiz_id}' <> pg_temp.v('e1') OR (c #>> '{minha_do_dia,versao}')::int <> 2
     OR c #>> '{ultima_estruturada,dados,problemas}' NOT LIKE '%Diabetes%' THEN
    RAISE EXCEPTION 'FALHOU: contexto depois da evolução (%)', c;
  END IF;
  RAISE NOTICE 'OK  contexto mostra a evolução do dia (vigente) e a última estruturada para herdar';
END $$;

-- ── guarda: nada se apaga ───────────────────────────────────────────────────
SELECT pg_temp.falha('DELETE FROM public.evolucoes_estruturadas', 'Registro clínico não se apaga', 'evolução estruturada não se apaga');
SELECT pg_temp.falha('DELETE FROM public.resumos_clinicos', 'Registro clínico não se apaga', 'resumo clínico não se apaga');
DO $$ DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.documentos_clinicos (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, internacao_id,
    tipo_documento, conteudo, conteudo_hash, autor_id, estado)
  SELECT v, v, 1, organizacao_id, unidade_id, paciente_id, internacao_id, 'evolucao', 'Evolução paralela', 'x', autor_id, 'ativo'
    FROM public.documentos_clinicos WHERE id = pg_temp.u('e2');
  BEGIN
    INSERT INTO public.evolucoes_estruturadas (documento_id, documento_raiz_id, versao, tipo_documento, unidade_id, paciente_id,
      internacao_id, autor_id, dia, papel, complemento_de)
    SELECT v, v, 1, 'evolucao', unidade_id, paciente_id, internacao_id, autor_id, private.data_atual(), 'do_dia', NULL
      FROM public.documentos_clinicos WHERE id = v;
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK  o índice único garante uma evolução do dia por profissional';
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: duas evoluções do dia para o mesmo profissional';
END $$;

ROLLBACK;
