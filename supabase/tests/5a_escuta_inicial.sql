-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270213000001_escuta_inicial_ubs.sql (5A, tarefa 2,
-- parte 2.4). Tudo em transação com ROLLBACK. O cenário é criado aqui, sem
-- depender do seed; roda também na homologação.
--
-- 1. ficha: "escuta inicial" nasce em triagem; os outros tipos, em atendimento;
--    o médico não abre a consulta antes da escuta;
-- 2. quem escuta: só o enfermeiro de plantão (técnico, recepção e médico não);
-- 3. regras: escala do CAB 28 (sem laranja); azul só orienta ou agenda, com o
--    texto; vermelho, amarelo e verde só vão à consulta;
-- 4. amarelo com sinais vitais: vai à fila do médico com a cor; a
--    classificação fica como CAB 28; o médico vê a escuta e os sinais;
-- 5. azul: encerra com a orientação; não escuta duas vezes;
-- 6. CHECK: o CAB 28 não aceita laranja nem saída trocada; a porta segue sem
--    protocolo.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000055a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000055a2'),
  ('cons', '00000000-0000-4000-8000-0000000055a3'),
  ('rec',  '00000000-0000-4000-8000-0000000055a4'),
  ('enf',  '00000000-0000-4000-8000-0000000055a5'),
  ('tec',  '00000000-0000-4000-8000-0000000055a6'),
  ('med',  '00000000-0000-4000-8000-0000000055a7');
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
CREATE TEMP TABLE epi (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON epi TO authenticated;
CREATE FUNCTION pg_temp.e(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM epi WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.e(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a24.local' FROM ids WHERE nome IN ('rec', 'enf', 'tec', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'tec', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do 5A24');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do 5A24', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'),
  (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('tec'), pg_temp.id('ubs'), 'tecnico_enfermagem'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'enf', 'tec', 'med']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── 1. ficha ────────────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO epi SELECT 'amarelo', (public.registrar_ficha(pg_temp.id('cons'), 'Febre há 2 dias', NULL,
  '{"nome":"Paciente Escuta Um","data_nascimento":"1990-04-04","tipo_atendimento":"escuta_inicial"}') ->> 'episodio_id')::uuid;
INSERT INTO epi SELECT 'azul', (public.registrar_ficha(pg_temp.id('cons'), 'Quer saber da vacina', NULL,
  '{"nome":"Paciente Escuta Dois","data_nascimento":"1985-08-08","tipo_atendimento":"escuta_inicial"}') ->> 'episodio_id')::uuid;
INSERT INTO epi SELECT 'direta', (public.registrar_ficha(pg_temp.id('cons'), 'Renovação de receita', NULL,
  '{"nome":"Paciente Direto","data_nascimento":"1960-01-01","tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'triagem' AND tipo_atendimento_aps = 'escuta_inicial' FROM public.episodios WHERE id = pg_temp.e('amarelo')),
  'ficha de escuta inicial nasce na fila da enfermagem');
SELECT pg_temp.ok((SELECT etapa = 'atendimento' FROM public.episodios WHERE id = pg_temp.e('direta')),
  'os outros tipos seguem direto para o médico');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.falha($$SELECT public.iniciar_atendimento(pg_temp.e('amarelo'))$$, 'O paciente não está aguardando atendimento médico',
  'o médico não abre a consulta antes da escuta');
RESET ROLE;
SELECT pg_temp.ok((SELECT atendimento_iniciado_em IS NULL AND etapa = 'triagem' FROM public.episodios WHERE id = pg_temp.e('amarelo')),
  'a ficha segue aguardando a escuta');
SET LOCAL ROLE authenticated;

-- ── 2. quem escuta ──────────────────────────────────────────────────────────
SELECT pg_temp.como('tec');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('amarelo'), 'amarelo', 'consulta')$$,
  'A escuta inicial e a classificação são do enfermeiro', 'técnico de enfermagem não classifica');
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('amarelo'), 'amarelo', 'consulta')$$,
  'A escuta inicial e a classificação são do enfermeiro', 'recepção não classifica');
SELECT pg_temp.como('med');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('amarelo'), 'amarelo', 'consulta')$$,
  'A escuta inicial e a classificação são do enfermeiro', 'médico não classifica');

-- ── 3. regras ───────────────────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('amarelo'), 'laranja', 'consulta')$$,
  'Escolha a classificação do CAB 28', 'laranja não é do CAB 28');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('azul'), 'azul', 'consulta', NULL, '{}', NULL, 'Orientado sobre a vacina')$$,
  'Situação não aguda (azul)', 'azul não vai à consulta');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('amarelo'), 'amarelo', 'orientacao')$$,
  'Situação aguda', 'aguda não encerra com orientação');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('azul'), 'azul', 'orientacao')$$,
  'Escreva a orientação dada', 'azul exige o texto da orientação');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('amarelo'), 'amarelo', 'consulta', NULL, '{"frequencia-cardiaca":"98"}')$$,
  'Sinal vital sem número', 'sinal vital tem de ser número');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('direta'), 'verde', 'consulta')$$,
  'Este paciente não está aguardando a escuta', 'a consulta direta não passa pela escuta');

-- ── 4. amarelo com sinais vitais ────────────────────────────────────────────
SELECT public.registrar_escuta_aps(pg_temp.e('amarelo'), 'amarelo', 'consulta', 'Febre de 38,5 há 2 dias e dor de garganta',
  '{"temperatura":38.5,"frequencia-cardiaca":98}');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'atendimento' AND cor_atual = 'amarelo' AND classificado_em IS NOT NULL AND publico = 'adulto'
                     FROM public.episodios WHERE id = pg_temp.e('amarelo')), 'amarelo vai para a fila do médico com a cor');
SELECT pg_temp.ok((SELECT protocolo = 'cab28' AND saida_escuta = 'consulta' AND autor_papel = 'enfermeiro' AND fluxograma_id IS NULL
                     FROM public.classificacoes_risco WHERE episodio_id = pg_temp.e('amarelo')), 'classificação gravada como CAB 28');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.observacao WHERE episodio_id = pg_temp.e('amarelo')), 'os dois sinais vitais ficam aferidos');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.log_auditoria WHERE entidade_id = pg_temp.e('amarelo') AND acao = 'escuta_aps_registrada'
                     AND payload ->> 'cor' = 'amarelo' AND payload ->> 'status' = 'consulta'
                     AND payload ->> 'escala' = 'cab28'), 'escuta na auditoria');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.e('amarelo'));
SELECT pg_temp.ok((SELECT cor = 'amarelo' AND queixa = 'Febre de 38,5 há 2 dias e dor de garganta' AND (sinais ->> 'temperatura')::numeric = 38.5
                     FROM public.classificacoes_do_episodio(pg_temp.e('amarelo'))), 'o médico vê a escuta, a queixa e os sinais');

-- ── 5. azul ─────────────────────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT public.registrar_escuta_aps(pg_temp.e('azul'), 'azul', 'orientacao', NULL, '{}', NULL, 'Orientado sobre o calendário de vacinas');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND cor_atual = 'azul' AND desfecho IS NULL AND desfecho_motivo = 'Orientado sobre o calendário de vacinas'
                          AND encerrado_por = pg_temp.id('enf') FROM public.episodios WHERE id = pg_temp.e('azul')), 'azul encerra com a orientação');
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.e('azul'), 'verde', 'consulta')$$,
  'Este paciente não está aguardando a escuta', 'não escuta duas vezes');
RESET ROLE;

-- ── 6. CHECKs ───────────────────────────────────────────────────────────────
SELECT pg_temp.falha($$INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, protocolo, saida_escuta)
  SELECT id, unidade_id, paciente_id, 'laranja', 'adulto', pg_temp.id('enf'), 'enfermeiro', 'cab28', 'consulta' FROM public.episodios WHERE id = pg_temp.e('direta')$$,
  'new row for relation "classificacoes_risco" violates check constraint', 'CHECK: CAB 28 sem laranja');
SELECT pg_temp.falha($$INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, protocolo, saida_escuta)
  SELECT id, unidade_id, paciente_id, 'azul', 'adulto', pg_temp.id('enf'), 'enfermeiro', 'cab28', 'consulta' FROM public.episodios WHERE id = pg_temp.e('direta')$$,
  'new row for relation "classificacoes_risco" violates check constraint', 'CHECK: azul não sai para a consulta');
SELECT pg_temp.falha($$INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, saida_escuta)
  SELECT id, unidade_id, paciente_id, 'verde', 'adulto', pg_temp.id('enf'), 'enfermeiro', 'consulta' FROM public.episodios WHERE id = pg_temp.e('direta')$$,
  'new row for relation "classificacoes_risco" violates check constraint', 'CHECK: saída da escuta só no CAB 28');

ROLLBACK;
