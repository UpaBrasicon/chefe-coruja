-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000028_ubs_u15_sala_vacina.sql (Percurso da UBS,
-- U15, vacina, PR 4). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. aplicação: o enfermeiro e o técnico de plantão registram; recepção,
--    médico e enfermeiro fora do plantão não;
-- 2. regras do LEDI: vacina x estratégia x dose, lote da UBS na validade e da
--    vacina, grupo ativo, via x local, condição maternal pelo sexo, hanseníase
--    só na BCG, estratégia especial com CBO e CID, a mesma vacina duas vezes no
--    dia;
-- 3. registro anterior (caderneta): sem lote; estratégia em branco ou Pesquisa;
--    data entre o nascimento e hoje; COVID-19 com "no exterior"; dose repetida;
-- 4. caderneta: quem lê, quem pode registrar;
-- 5. cancelar: quem registrou, com motivo; cancelada, a vacina volta a poder
--    ser registrada;
-- 6. a tabela: quem cuida lê; a recepção não; ninguém grava direto.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-0000000119a1'),
  ('ubs',    '00000000-0000-4000-8000-0000000119a2'),
  ('sala',   '00000000-0000-4000-8000-0000000119a3'),
  ('enf',    '00000000-0000-4000-8000-0000000119b1'),
  ('tec',    '00000000-0000-4000-8000-0000000119b2'),
  ('enf2',   '00000000-0000-4000-8000-0000000119b3'),
  ('med',    '00000000-0000-4000-8000-0000000119b4'),
  ('rec',    '00000000-0000-4000-8000-0000000119b5'),
  ('menino', '00000000-0000-4000-8000-0000000119c1'),
  ('mulher', '00000000-0000-4000-8000-0000000119c2'),
  ('l_penta','00000000-0000-4000-8000-0000000119d1'),
  ('l_dtpa', '00000000-0000-4000-8000-0000000119d2'),
  ('l_venc', '00000000-0000-4000-8000-0000000119d3'),
  ('l_bcg',  '00000000-0000-4000-8000-0000000119d4');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
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
CREATE TEMP TABLE v (nome text PRIMARY KEY, r jsonb) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.vac(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT (r #>> '{}')::uuid FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.vac(text) TO authenticated;
-- dados de uma aplicação; o que vier em p_extra substitui
CREATE FUNCTION pg_temp.ap(p_imuno int, p_estr int, p_dose int, p_lote text, p_extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('imunobiologico', p_imuno, 'estrategia', p_estr, 'dose', p_dose, 'lote_id', pg_temp.id(p_lote),
                            'grupo_atendimento', 121, 'via', 3, 'local', 2) || p_extra $$;
GRANT EXECUTE ON FUNCTION pg_temp.ap(int, int, int, text, jsonb) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15sala.local' FROM ids WHERE nome IN ('enf', 'tec', 'enf2', 'med', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('enf', 'tec', 'enf2', 'med', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15 sala');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U15 sala', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('sala'), pg_temp.id('ubs'), 'Sala de vacina', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'), (pg_temp.id('tec'), pg_temp.id('ubs'), 'tecnico_enfermagem'),
  (pg_temp.id('enf2'), pg_temp.id('ubs'), 'enfermeiro'), (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'),
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao');
-- de plantão agora: enf, tec, med e rec (enf2 fora da escala)
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('sala'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['enf', 'tec', 'med', 'rec']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;
INSERT INTO public.pacientes (id, unidade_id, nome, sexo, data_nascimento) VALUES
  (pg_temp.id('menino'), pg_temp.id('ubs'), 'Menino Vacina', 'M', private.data_atual() - 60),
  (pg_temp.id('mulher'), pg_temp.id('ubs'), 'Mulher Vacina', 'F', date '1995-04-04');
INSERT INTO public.vacina_lotes (id, unidade_id, imunobiologico, lote, fabricante, validade, criado_por) VALUES
  (pg_temp.id('l_penta'), pg_temp.id('ubs'), 42, 'PENTA01', '152', private.data_atual() + 90, pg_temp.id('enf')),
  (pg_temp.id('l_dtpa'), pg_temp.id('ubs'), 57, 'DTPA01', '149', private.data_atual() + 90, pg_temp.id('enf')),
  (pg_temp.id('l_venc'), pg_temp.id('ubs'), 42, 'PENTA00', '152', private.data_atual() - 1, pg_temp.id('enf')),
  (pg_temp.id('l_bcg'), pg_temp.id('ubs'), 15, 'BCG01', '149', private.data_atual() + 90, pg_temp.id('enf'));
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('D80.0', 'Teste U15') ON CONFLICT DO NOTHING;

-- ── 1 e 2. aplicação ────────────────────────────────────────────────────────
SELECT pg_temp.como('enf');
INSERT INTO v SELECT 'penta', to_jsonb(public.vacina_aplicar(pg_temp.id('menino'), pg_temp.ap(42, 1, 1, 'l_penta')));
SELECT pg_temp.ok((SELECT lote = 'PENTA01' AND fabricante = '152' AND grupo_atendimento = 121 AND NOT registro_anterior
                          AND data_aplicacao = private.data_atual() AND registrado_por = pg_temp.id('enf')
                     FROM public.vacinacoes WHERE id = pg_temp.vac('penta')),
  '1. o enfermeiro de plantão aplica a penta (lote e fabricante do cadastro, autor = login)');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id = pg_temp.vac('penta') AND acao = 'vacina_aplicada'),
  '1. a aplicação tem auditoria');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('menino'), pg_temp.ap(42, 1, 2, 'l_penta'))$$,
  'Esta vacina já foi registrada hoje', '2. a mesma vacina duas vezes no dia é recusada');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('menino'), pg_temp.ap(42, 1, 4, 'l_penta'))$$,
  'Essa combinação de vacina', '2. penta de rotina não tem 4ª dose');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(42, 1, 1, 'l_venc', '{"condicao_maternal": 1}'))$$,
  'Escolha um lote da UBS', '2. lote vencido é recusado');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(42, 1, 1, 'l_dtpa', '{"condicao_maternal": 1}'))$$,
  'Escolha um lote da UBS', '2. lote de outra vacina é recusado');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(57, 1, 8, 'l_dtpa', '{"condicao_maternal": 1, "grupo_atendimento": 10}'))$$,
  'Escolha o grupo de atendimento', '2. grupo inativo é recusado');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(57, 1, 8, 'l_dtpa', '{"condicao_maternal": 1, "local": 14}'))$$,
  'Escolha a via e um local', '2. intramuscular na face externa do braço é recusada');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(57, 1, 8, 'l_dtpa'))$$,
  'Informe a condição maternal', '2. mulher sem condição maternal é recusada');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('menino'), pg_temp.ap(15, 1, 9, 'l_bcg', '{"via": 2, "local": 14, "condicao_maternal": 1, "comunicante_hanseniase": false}'))$$,
  'Condição maternal só fora do sexo masculino', '2. menino com condição maternal é recusado');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('menino'), pg_temp.ap(15, 1, 9, 'l_bcg', '{"via": 2, "local": 14}'))$$,
  'Na BCG, informe se é comunicante', '2. BCG pede comunicante de hanseníase');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(57, 1, 8, 'l_dtpa', '{"condicao_maternal": 2, "comunicante_hanseniase": true}'))$$,
  'Comunicante de hanseníase só na BCG', '2. hanseníase fora da BCG é recusada');
INSERT INTO v SELECT 'bcg', to_jsonb(public.vacina_aplicar(pg_temp.id('menino'),
  pg_temp.ap(15, 1, 9, 'l_bcg', '{"via": 2, "local": 14, "comunicante_hanseniase": false}')));
SELECT pg_temp.ok((SELECT comunicante_hanseniase = false AND via = 2 FROM public.vacinacoes WHERE id = pg_temp.vac('bcg')),
  '2. BCG intradérmica, com comunicante de hanseníase informado');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(42, 2, 8, 'l_penta', '{"condicao_maternal": 1}'))$$,
  'Estratégia especial: informe o CBO', '2. estratégia especial pede o CBO do prescritor');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(42, 2, 8, 'l_penta', '{"condicao_maternal": 1, "prescritor_cbo": "225125", "cid10_motivo": "ZZZ"}'))$$,
  'Estratégia especial: informe o CID-10', '2. estratégia especial pede o CID-10 do motivo');
INSERT INTO v SELECT 'especial', to_jsonb(public.vacina_aplicar(pg_temp.id('mulher'),
  pg_temp.ap(42, 2, 8, 'l_penta', '{"condicao_maternal": 1, "prescritor_cbo": "225125", "cid10_motivo": "d80.0"}')));
SELECT pg_temp.ok((SELECT prescritor_cbo = '225125' AND cid10_motivo = 'D80.0' FROM public.vacinacoes WHERE id = pg_temp.vac('especial')),
  '2. estratégia especial com CBO e CID');

SELECT pg_temp.como('tec');
INSERT INTO v SELECT 'dtpa', to_jsonb(public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(57, 1, 8, 'l_dtpa', '{"condicao_maternal": 2}')));
SELECT pg_temp.ok((SELECT condicao_maternal = 2 FROM public.vacinacoes WHERE id = pg_temp.vac('dtpa')), '1. o técnico de plantão aplica a dTpa na gestante');
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(57, 1, 8, 'l_dtpa', '{"condicao_maternal": 2}'))$$,
  'Só o técnico de enfermagem e o enfermeiro', '1. a recepção não registra vacina');
SELECT pg_temp.como('med');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(57, 1, 8, 'l_dtpa', '{"condicao_maternal": 2}'))$$,
  'Só o técnico de enfermagem e o enfermeiro', '1. o médico não registra vacina (VC2 = A)');
SELECT pg_temp.como('enf2');
SELECT pg_temp.falha($$SELECT public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(57, 1, 8, 'l_dtpa', '{"condicao_maternal": 2}'))$$,
  'Só o técnico de enfermagem e o enfermeiro', '1. o enfermeiro fora do plantão não registra');

-- ── 3. registro anterior ────────────────────────────────────────────────────
SELECT pg_temp.como('tec');
INSERT INTO v SELECT 'hb', to_jsonb(public.vacina_registrar_anterior(pg_temp.id('menino'),
  jsonb_build_object('imunobiologico', 9, 'dose', 1, 'data_aplicacao', private.data_atual() - 60, 'via', 3, 'local', 18)));
SELECT pg_temp.ok((SELECT registro_anterior AND lote IS NULL AND grupo_atendimento IS NULL AND estrategia IS NULL
                     FROM public.vacinacoes WHERE id = pg_temp.vac('hb')),
  '3. a hepatite B do nascimento entra pela caderneta, sem lote nem grupo');
SELECT pg_temp.falha($$SELECT public.vacina_registrar_anterior(pg_temp.id('menino'),
  jsonb_build_object('imunobiologico', 9, 'dose', 1, 'data_aplicacao', private.data_atual() - 60, 'via', 3, 'local', 18))$$,
  'Esta dose já está na caderneta', '3. a mesma dose na mesma data é recusada');
SELECT pg_temp.falha($$SELECT public.vacina_registrar_anterior(pg_temp.id('menino'),
  jsonb_build_object('imunobiologico', 9, 'dose', 2, 'data_aplicacao', private.data_atual() - 61, 'via', 3, 'local', 18))$$,
  'A data da vacina vai do nascimento até hoje', '3. data antes do nascimento é recusada');
SELECT pg_temp.falha($$SELECT public.vacina_registrar_anterior(pg_temp.id('menino'),
  jsonb_build_object('imunobiologico', 9, 'dose', 2, 'estrategia', 1, 'data_aplicacao', private.data_atual() - 30, 'via', 3, 'local', 18))$$,
  'No registro anterior, a estratégia', '3. estratégia de rotina no registro anterior é recusada');
SELECT pg_temp.falha($$SELECT public.vacina_registrar_anterior(pg_temp.id('mulher'),
  jsonb_build_object('imunobiologico', 85, 'dose', 1, 'data_aplicacao', date '2021-08-01', 'via', 3, 'local', 2, 'condicao_maternal', 1))$$,
  'Vacina de COVID-19: informe se foi aplicada no exterior', '3. COVID-19 pede "aplicada no exterior"');
INSERT INTO v SELECT 'covid', to_jsonb(public.vacina_registrar_anterior(pg_temp.id('mulher'),
  jsonb_build_object('imunobiologico', 85, 'dose', 1, 'data_aplicacao', date '2021-08-01', 'via', 3, 'local', 2,
                     'condicao_maternal', 1, 'aplicado_exterior', false)));
SELECT pg_temp.ok((SELECT aplicado_exterior = false FROM public.vacinacoes WHERE id = pg_temp.vac('covid')), '3. COVID-19 com "no exterior" informado');
SELECT pg_temp.ok((SELECT aplicado_exterior IS NULL FROM public.vacinacoes WHERE id = pg_temp.vac('hb')), '3. fora da COVID-19, "no exterior" fica vazio');

-- ── 4. caderneta ────────────────────────────────────────────────────────────
SELECT pg_temp.como('med');
INSERT INTO v SELECT 'cad', public.vacina_caderneta(pg_temp.id('menino'));
SELECT pg_temp.ok((SELECT jsonb_array_length(r -> 'registros') = 3 AND NOT (r ->> 'pode_registrar')::boolean
                          AND r #>> '{paciente,sexo}' = 'M' FROM v WHERE nome = 'cad'),
  '4. o médico lê a caderneta (3 vacinas do menino) e não registra');
SELECT pg_temp.como('tec');
SELECT pg_temp.ok((public.vacina_caderneta(pg_temp.id('menino')) ->> 'pode_registrar')::boolean, '4. o técnico de plantão pode registrar');
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.vacina_caderneta(pg_temp.id('menino'))$$, 'Acesso negado', '4. a recepção não lê a caderneta');

-- ── 5. cancelar ─────────────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.vacina_cancelar(pg_temp.vac('dtpa'), 'lançada por engano')$$,
  'Só quem registrou', '5. a recepção não cancela');
SELECT pg_temp.como('tec');
SELECT pg_temp.falha($$SELECT public.vacina_cancelar(pg_temp.vac('dtpa'), 'x')$$, 'Escreva o motivo', '5. cancelar pede motivo');
SELECT public.vacina_cancelar(pg_temp.vac('dtpa'), 'lançada no paciente errado');
SELECT pg_temp.ok((SELECT cancelado_em IS NOT NULL AND cancelado_por = pg_temp.id('tec') FROM public.vacinacoes WHERE id = pg_temp.vac('dtpa')),
  '5. quem registrou cancela, e o registro fica marcado');
SELECT pg_temp.falha($$SELECT public.vacina_cancelar(pg_temp.vac('dtpa'), 'de novo, por engano')$$, 'Este registro já está cancelado', '5. não cancela duas vezes');
SELECT pg_temp.ok(public.vacina_aplicar(pg_temp.id('mulher'), pg_temp.ap(57, 1, 8, 'l_dtpa', '{"condicao_maternal": 2}')) IS NOT NULL,
  '5. cancelada, a dTpa volta a poder ser registrada no dia');

-- ── 6. a tabela ─────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM public.vacinacoes WHERE unidade_id = pg_temp.id('ubs')) = 7, '6. o técnico lê as vacinas da unidade');
SELECT pg_temp.falha($$DELETE FROM public.vacinacoes$$, 'permission denied', '6. ninguém apaga direto');
RESET ROLE;
SELECT pg_temp.como('rec');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM public.vacinacoes) = 0, '6. a recepção não lê a tabela');
RESET ROLE;

ROLLBACK;
