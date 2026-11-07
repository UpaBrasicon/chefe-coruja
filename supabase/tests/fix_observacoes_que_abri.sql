-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270305000002_observacoes_que_abri.sql (decisão do RT
-- em 06/11/2026: "Sim, mostrar"). O médico da porta vê as observações que ele
-- abriu, só para encerrá-las. Depende da 20270305000001 (abriu_a_observacao).
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. a lista do autor traz as observações dele, com o mínimo para o cartão;
-- 2. outro médico, o autor fora do plantão e o autor que virou enfermeiro
--    recebem a lista vazia;
-- 3. depois do encerramento a observação sai da lista;
-- 4. observação sem desfecho da porta não aparece; outra unidade não aparece;
-- 5. as leituras do diálogo de encerramento (setores e leitos da internação)
--    já abrem para o autor sem escala na observação;
-- 6. sem o segundo fator, falha; anon não executa.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-0000000a0f01'),
  ('upa',    '00000000-0000-4000-8000-0000000a0f02'),
  ('upa2',   '00000000-0000-4000-8000-0000000a0f03'),
  ('porta',  '00000000-0000-4000-8000-0000000a0f11'),
  ('obs',    '00000000-0000-4000-8000-0000000a0f12'),
  ('cm',     '00000000-0000-4000-8000-0000000a0f13'),
  ('porta2', '00000000-0000-4000-8000-0000000a0f14'),
  ('obs2',   '00000000-0000-4000-8000-0000000a0f15'),
  ('med',    '00000000-0000-4000-8000-0000000a0f21'),  -- autor: de plantão na porta
  ('med2',   '00000000-0000-4000-8000-0000000a0f22'),  -- outro médico da porta
  ('medfora','00000000-0000-4000-8000-0000000a0f24'),  -- autor que sai do plantão
  ('medenf', '00000000-0000-4000-8000-0000000a0f25'),  -- autor que passa a enfermeiro
  ('medab',  '00000000-0000-4000-8000-0000000a0f26'),  -- autor na UPA 2, de plantão na UPA 1
  ('rec',    '00000000-0000-4000-8000-0000000a0f27'),
  ('rec2',   '00000000-0000-4000-8000-0000000a0f28');
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
-- as internações da lista de quem chama, numa unidade
CREATE FUNCTION pg_temp.lista(p_unidade text) RETURNS uuid[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(x.internacao_id ORDER BY x.internacao_id), '{}') FROM public.observacoes_que_abri(pg_temp.id(p_unidade)) x $$;
GRANT EXECUTE ON FUNCTION pg_temp.lista(text) TO authenticated;
-- a ficha chega, o médico atende na porta e põe em observação (desfecho da porta)
CREATE FUNCTION pg_temp.observar(p_nome text, p_medico text, p_rec text, p_porta text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_ep uuid;
BEGIN
  PERFORM pg_temp.como(p_rec);
  SET LOCAL ROLE authenticated;
  v_ep := (public.registrar_ficha(pg_temp.id(p_porta), 'Dor abdominal', NULL,
    json_build_object('nome', 'Paciente Lista ' || upper(p_nome), 'data_nascimento', '1980-01-01')::jsonb) ->> 'episodio_id')::uuid;
  RESET ROLE;
  -- a classificação de risco não é o assunto daqui: o paciente vai direto ao médico
  UPDATE public.episodios SET etapa = 'atendimento' WHERE id = v_ep;
  PERFORM pg_temp.como(p_medico);
  SET LOCAL ROLE authenticated;
  PERFORM public.iniciar_atendimento(v_ep);
  PERFORM public.registrar_soap(v_ep, 'Dor abdominal há 6 horas', 'Abdome doloroso, sem peritonite',
    'Dor abdominal a esclarecer', 'Observação com analgesia e reavaliação', 'R60');
  PERFORM public.registrar_desfecho(v_ep, 'observacao');
  RESET ROLE;
  INSERT INTO v VALUES ('e' || p_nome, v_ep);
  INSERT INTO v SELECT 'i' || p_nome, id FROM public.internacoes WHERE episodio_id = v_ep;
  INSERT INTO v SELECT 'p' || p_nome, paciente_id FROM public.episodios WHERE id = v_ep;
END $$;

INSERT INTO auth.users (id, email) SELECT id, nome || '@fixlista.local' FROM ids WHERE nome LIKE 'med%' OR nome LIKE 'rec%';
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome LIKE 'med%' OR nome LIKE 'rec%'
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do fix da lista');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA Um da lista', 'upa'),
  (pg_temp.id('upa2'), pg_temp.id('org'), 'UPA Dois da lista', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação Adulto', 'observacao'),
  (pg_temp.id('cm'), pg_temp.id('upa'), 'Clínica Médica', 'internacao'),
  (pg_temp.id('porta2'), pg_temp.id('upa2'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('obs2'), pg_temp.id('upa2'), 'Observação Adulto', 'observacao');
INSERT INTO public.leitos (setor_id, identificador, tipo)
SELECT pg_temp.id('obs'), 'OA-0' || n, 'observacao'::public.tipo_leito FROM generate_series(1, 6) n
UNION ALL SELECT pg_temp.id('obs2'), 'OA-01', 'observacao'::public.tipo_leito
UNION ALL SELECT pg_temp.id('cm'), 'CM-01', 'clinico'::public.tipo_leito;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('med2'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('medfora'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('medenf'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('medab'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('medab'), pg_temp.id('upa2'), 'plantonista'),
  (pg_temp.id('rec'), pg_temp.id('upa'), 'recepcao'), (pg_temp.id('rec2'), pg_temp.id('upa2'), 'recepcao');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id(u), pg_temp.id(s), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES ('upa', 'porta', 'med'), ('upa', 'porta', 'med2'), ('upa', 'porta', 'medfora'), ('upa', 'porta', 'medenf'),
               ('upa', 'porta', 'medab'), ('upa2', 'porta2', 'medab'), ('upa', 'porta', 'rec'), ('upa2', 'porta2', 'rec2')) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('upa'), pg_temp.id('upa2')) ON CONFLICT DO NOTHING;

-- ── observações abertas pela porta ──────────────────────────────────────────
SELECT pg_temp.observar(x, 'med', 'rec', 'porta') FROM unnest(ARRAY['a', 'b']) x;
SELECT pg_temp.observar('f', 'medfora', 'rec', 'porta');
SELECT pg_temp.observar('g', 'medenf', 'rec', 'porta');
SELECT pg_temp.observar('x', 'medab', 'rec2', 'porta2');
-- observação sem desfecho da porta: o paciente entrou direto no box (sem episódio)
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento)
VALUES ('00000000-0000-4000-8000-0000000a0f31', pg_temp.id('upa'), 'Paciente Sem Porta', '1975-05-05');
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, tipo_internacao, origem_admissao, status, setor_atual_id, data_entrada_setor)
VALUES (pg_temp.id('org'), pg_temp.id('upa'), '00000000-0000-4000-8000-0000000a0f31', 'observacao', 'emergencia', 'em_observacao', pg_temp.id('obs'), now());
INSERT INTO v SELECT 'isolta', id FROM public.internacoes WHERE paciente_id = '00000000-0000-4000-8000-0000000a0f31';

-- o autor sai do plantão; o outro passa a enfermeiro; o terceiro sai do plantão da UPA 2
UPDATE public.escala_plantao SET ativo = false WHERE perfil_id = pg_temp.id('medfora');
UPDATE public.vinculos SET papel = 'enfermeiro' WHERE perfil_id = pg_temp.id('medenf') AND unidade_id = pg_temp.id('upa');
UPDATE public.escala_plantao SET ativo = false WHERE perfil_id = pg_temp.id('medab') AND unidade_id = pg_temp.id('upa2');

SET LOCAL ROLE authenticated;

-- ── 1. a lista do autor ─────────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.ok(pg_temp.lista('upa') = (SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[pg_temp.v('ia'), pg_temp.v('ib')]) x),
  'a lista do autor traz as duas observações dele, e só elas');
SELECT pg_temp.ok((SELECT x.paciente_id = pg_temp.v('pa')
                          AND x.nome = 'Paciente Lista A' AND x.nome_social IS NULL AND x.data_nascimento = '1980-01-01'
                          AND x.setor_nome = 'Observação Adulto' AND x.box LIKE 'OA-0%'
                          AND x.entrada <= now() AND abs(extract(epoch FROM x.prazo - (x.entrada + interval '6 hours'))) < 5
                     FROM public.observacoes_que_abri(pg_temp.id('upa')) x WHERE x.internacao_id = pg_temp.v('ia')),
  'o cartão traz paciente, nascimento, setor, box, entrada e o prazo de 6 h');
SELECT pg_temp.ok((SELECT string_agg(x, ',' ORDER BY o)
                         FROM unnest((SELECT proargnames FROM pg_proc WHERE oid = 'public.observacoes_que_abri(uuid)'::regprocedure)) WITH ORDINALITY u(x, o)
                        WHERE o > 1)
                      = 'internacao_id,paciente_id,nome,nome_social,data_nascimento,setor_nome,box,entrada,prazo',
  'a lista expõe só os campos do cartão (sem prescrição, evolução ou sinais)');

-- ── 5. o diálogo de encerramento abre para o autor ──────────────────────────
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.setores_internacao(pg_temp.id('upa')) s WHERE s.id = pg_temp.id('cm')),
  'os setores de internação do diálogo abrem para o autor (membro da unidade)');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.leitos_para_ocupar(pg_temp.id('cm'),
                    pg_temp.v('pa')) l WHERE l.identificador = 'CM-01'),
  'os leitos livres do diálogo abrem para o autor (membro da unidade)');

-- ── 2. listas vazias ────────────────────────────────────────────────────────
SELECT pg_temp.como('med2');
SELECT pg_temp.ok(cardinality(pg_temp.lista('upa')) = 0, 'outro médico da porta recebe a lista vazia');
SELECT pg_temp.como('medfora');
SELECT pg_temp.ok(cardinality(pg_temp.lista('upa')) = 0, 'o autor fora do plantão recebe a lista vazia');
SELECT pg_temp.como('medenf');
SELECT pg_temp.ok(cardinality(pg_temp.lista('upa')) = 0, 'o autor que agora é enfermeiro recebe a lista vazia');

-- ── 4. outra unidade e observação sem desfecho da porta ─────────────────────
SELECT pg_temp.como('medab');
SELECT pg_temp.ok(cardinality(pg_temp.lista('upa2')) = 0 AND cardinality(pg_temp.lista('upa')) = 0,
  'o autor de plantão na UPA 1 não vê a observação que abriu na UPA 2');
SELECT pg_temp.como('med');
SELECT pg_temp.ok(cardinality(pg_temp.lista('upa2')) = 0, 'a lista de outra unidade vem vazia');
SELECT pg_temp.ok(NOT (pg_temp.v('isolta') = ANY (pg_temp.lista('upa'))), 'observação sem desfecho da porta não aparece');

-- ── 3. encerrada, sai da lista ──────────────────────────────────────────────
SELECT public.finalizar_observacao(pg_temp.v('ia'), 'alta_medica', 'R60');
SELECT pg_temp.ok(pg_temp.lista('upa') = ARRAY[pg_temp.v('ib')], 'depois de encerrada, a observação sai da lista do autor');
SELECT public.finalizar_observacao(pg_temp.v('ib'), 'internacao', NULL, NULL, json_build_object('setor_id', pg_temp.id('cm'))::jsonb);
SELECT pg_temp.ok(cardinality(pg_temp.lista('upa')) = 0, 'convertida em internação, também sai da lista');
RESET ROLE;

-- ── 6. segundo fator e permissões ───────────────────────────────────────────
SELECT pg_temp.ok(NOT has_function_privilege('anon', 'public.observacoes_que_abri(uuid)', 'EXECUTE')
                  AND has_function_privilege('authenticated', 'public.observacoes_que_abri(uuid)', 'EXECUTE'),
  'anon não executa; authenticated executa');
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('med'), 'role', 'authenticated', 'aal', 'aal1')::text, true);
SELECT pg_temp.falha($$SELECT public.observacoes_que_abri(pg_temp.id('upa'))$$, 'SEGUNDO_FATOR', 'sem o segundo fator, a lista falha');
RESET ROLE;

ROLLBACK;
