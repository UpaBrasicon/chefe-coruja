-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000029_ubs_u15_vacina_paineis.sql (Percurso da
-- UBS, U15, vacina, PR 5). Tudo em transação com ROLLBACK; o cenário é criado
-- aqui. As vacinas entram como registro anterior (a nota conta a transcrição).
--
-- 1. C2: doses espaçadas de 30 dias; pentavalente por componente; tríplice viral
--    só depois dos 12 meses; o que falta; registro cancelado não conta;
-- 2. C3: dTpa só a partir da 20ª semana da gestação;
-- 3. C6: influenza nos últimos 12 meses soma 25 na média;
-- 4. C7: HPV na menina de 9 a 14 anos.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',      '00000000-0000-4000-8000-0000000121a1'),
  ('ubs',      '00000000-0000-4000-8000-0000000121a2'),
  ('ges',      '00000000-0000-4000-8000-0000000121b1'),
  ('enf',      '00000000-0000-4000-8000-0000000121b2'),
  ('bebe',     '00000000-0000-4000-8000-0000000121c1'),
  ('idoso',    '00000000-0000-4000-8000-0000000121c2'),
  ('menina',   '00000000-0000-4000-8000-0000000121c3'),
  ('gestante', '00000000-0000-4000-8000-0000000121c4'),
  ('gest',     '00000000-0000-4000-8000-0000000121d1');
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
-- uma vacina transcrita: paciente, código, dias depois do nascimento (ou data)
CREATE FUNCTION pg_temp.vac(p text, p_imuno int, p_data date) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.vacinacoes (unidade_id, paciente_id, registro_anterior, data_aplicacao, imunobiologico, dose, via, local, registrado_por)
  VALUES (pg_temp.id('ubs'), pg_temp.id(p), true, p_data, p_imuno, 8, 3, 2, pg_temp.id('enf')) RETURNING id $$;
CREATE FUNCTION pg_temp.nasc(p text) RETURNS date LANGUAGE sql AS $$ SELECT data_nascimento FROM public.pacientes WHERE id = pg_temp.id(p) $$;
CREATE TEMP TABLE r (nome text PRIMARY KEY, j jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15pain.local' FROM ids WHERE nome IN ('ges', 'enf');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'enf')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15 painéis');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U15 painéis', 'ubs');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro');
INSERT INTO public.pacientes (id, unidade_id, nome, sexo, data_nascimento) VALUES
  (pg_temp.id('bebe'), pg_temp.id('ubs'), 'Bebê Painel', 'M', private.data_atual() - 420),
  (pg_temp.id('idoso'), pg_temp.id('ubs'), 'Idoso Painel', 'M', (private.data_atual() - interval '70 years')::date),
  (pg_temp.id('menina'), pg_temp.id('ubs'), 'Menina Painel', 'F', (private.data_atual() - interval '11 years')::date),
  (pg_temp.id('gestante'), pg_temp.id('ubs'), 'Gestante Painel', 'F', date '1999-02-02');
INSERT INTO public.pre_natal_gestacoes (id, unidade_id, paciente_id, origem, dum)
VALUES (pg_temp.id('gest'), pg_temp.id('ubs'), pg_temp.id('gestante'), 'manual', private.data_atual() - 200);

-- ── 1. C2 ───────────────────────────────────────────────────────────────────
SELECT pg_temp.ok(private.vacina_c2_faltam(pg_temp.id('bebe'), pg_temp.nasc('bebe'))
                  = ARRAY['pentavalente', 'VIP', 'tríplice viral', 'pneumocócica'],
  '1. sem vacina, falta todo o esquema');
-- penta aos 60, 120 e 180 dias; VIP junto; pneumo aos 60 e 120
SELECT pg_temp.vac('bebe', 42, pg_temp.nasc('bebe') + d) FROM unnest(ARRAY[60, 120, 180]) d;
SELECT pg_temp.vac('bebe', 22, pg_temp.nasc('bebe') + d) FROM unnest(ARRAY[60, 120, 180]) d;
SELECT pg_temp.vac('bebe', 26, pg_temp.nasc('bebe') + d) FROM unnest(ARRAY[60, 120]) d;
-- tríplice viral: uma antes dos 12 meses (não conta) e uma depois
SELECT pg_temp.vac('bebe', 24, pg_temp.nasc('bebe') + 300);
SELECT pg_temp.vac('bebe', 24, pg_temp.nasc('bebe') + 370);
SELECT pg_temp.ok(private.vacina_c2_faltam(pg_temp.id('bebe'), pg_temp.nasc('bebe')) = ARRAY['tríplice viral'],
  '1. a tríplice viral antes dos 12 meses não conta: falta a 2ª dose');
INSERT INTO r SELECT 'scr2', to_jsonb(pg_temp.vac('bebe', 24, pg_temp.nasc('bebe') + 400));
SELECT pg_temp.ok(private.vacina_c2_faltam(pg_temp.id('bebe'), pg_temp.nasc('bebe')) = '{}', '1. esquema completo');
SELECT pg_temp.ok((private.puericultura_registros(pg_temp.id('bebe'), pg_temp.nasc('bebe')) -> 'vacinas_faltam') = '[]'::jsonb,
  '1. a puericultura recebe a lista vazia');
UPDATE public.vacinacoes SET cancelado_em = now(), cancelado_por = pg_temp.id('enf'), motivo_cancelamento = 'teste de cancelamento'
 WHERE id = (SELECT (j #>> '{}')::uuid FROM r WHERE nome = 'scr2');
SELECT pg_temp.ok(private.vacina_c2_faltam(pg_temp.id('bebe'), pg_temp.nasc('bebe')) = ARRAY['tríplice viral'],
  '1. registro cancelado não conta');
-- pentavalente por componente: só a hepatite B a mais não completa; doses a menos de 30 dias não contam
SELECT pg_temp.ok(private.vacina_doses_espacadas(pg_temp.id('bebe'), ARRAY[42], pg_temp.nasc('bebe'), private.data_atual(), 30) = 3,
  '1. três doses de penta espaçadas');
SELECT pg_temp.vac('bebe', 26, pg_temp.nasc('bebe') + 125);
SELECT pg_temp.ok(private.vacina_doses_espacadas(pg_temp.id('bebe'), ARRAY[26], pg_temp.nasc('bebe'), private.data_atual(), 30) = 2,
  '1. a dose 5 dias depois da anterior não conta');
SELECT pg_temp.ok(private.vacina_doses_espacadas(pg_temp.id('bebe'), ARRAY[9, 42, 43], pg_temp.nasc('bebe'), private.data_atual(), 30) = 3
                  AND private.vacina_doses_espacadas(pg_temp.id('bebe'), ARRAY[17, 29, 39, 42, 43], pg_temp.nasc('bebe'), private.data_atual(), 30) = 3,
  '1. a penta conta na hepatite B e no Hib');

-- ── 2. C3 ───────────────────────────────────────────────────────────────────
SELECT pg_temp.vac('gestante', 57, private.data_atual() - 200 + 100);
SELECT pg_temp.ok((private.pre_natal_registros(pg_temp.id('gest')) ->> 'dtpa') IS NULL, '2. dTpa antes da 20ª semana não conta');
SELECT pg_temp.vac('gestante', 57, private.data_atual() - 200 + 150);
SELECT pg_temp.ok((private.pre_natal_registros(pg_temp.id('gest')) ->> 'dtpa')::date = private.data_atual() - 50,
  '2. dTpa a partir da 20ª semana conta');

-- ── 3 e 4. C6 e C7 ──────────────────────────────────────────────────────────
SELECT pg_temp.vac('idoso', 33, private.data_atual() - 400);
SELECT pg_temp.como('ges');
INSERT INTO r SELECT 'antes', public.indicadores_aps(pg_temp.id('ubs'));
RESET ROLE;
SELECT pg_temp.vac('idoso', 77, private.data_atual() - 30);
SELECT pg_temp.vac('menina', 67, private.data_atual() - 10);
SELECT pg_temp.como('ges');
INSERT INTO r SELECT 'depois', public.indicadores_aps(pg_temp.id('ubs'));
RESET ROLE;
SELECT pg_temp.ok((SELECT (j #>> '{c6,influenza}')::int = 0 FROM r WHERE nome = 'antes'), '3. influenza de mais de 12 meses não conta');
SELECT pg_temp.ok((SELECT (j #>> '{c6,influenza}')::int = 1 AND (j #>> '{c6,media}')::numeric = 25 FROM r WHERE nome = 'depois'),
  '3. influenza nos últimos 12 meses: 25 na média do idoso');
SELECT pg_temp.ok((SELECT j #> '{c7,hpv}' = '{"faixa": 1, "feito": 1}'::jsonb FROM r WHERE nome = 'depois'), '4. HPV da menina de 11 anos conta');
SELECT pg_temp.ok((SELECT j #> '{c7,hpv}' = '{"faixa": 1, "feito": 0}'::jsonb FROM r WHERE nome = 'antes'), '4. sem HPV, a menina fica na faixa sem pontuar');

ROLLBACK;
