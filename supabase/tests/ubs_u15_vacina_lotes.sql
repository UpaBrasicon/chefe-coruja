-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000027_ubs_u15_vacina_lotes.sql (Percurso da UBS,
-- U15, vacina, PR 3). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. o gestor e o enfermeiro da UBS cadastram; o técnico e a recepção não; fora
--    da UBS, não;
-- 2. o que é conferido: imunobiológico com regra no LEDI, lote, fabricante da
--    RNDS, validade; lote repetido;
-- 3. a leitura: lotes, vencido, imunobiológicos e fabricantes; quem é de fora
--    não lê;
-- 4. desativar e reativar;
-- 5. lote válido na aplicação.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000117a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000117a2'),
  ('upa',  '00000000-0000-4000-8000-0000000117a3'),
  ('ges',  '00000000-0000-4000-8000-0000000117b1'),
  ('enf',  '00000000-0000-4000-8000-0000000117b2'),
  ('tec',  '00000000-0000-4000-8000-0000000117b3'),
  ('rec',  '00000000-0000-4000-8000-0000000117b4'),
  ('enfu', '00000000-0000-4000-8000-0000000117b5');
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
CREATE FUNCTION pg_temp.lote(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT (r #>> '{}')::uuid FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.lote(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15lote.local' FROM ids WHERE nome IN ('ges', 'enf', 'tec', 'rec', 'enfu');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'enf', 'tec', 'rec', 'enfu')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15 lotes');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U15 lotes', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do U15 lotes', 'upa');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('tec'), pg_temp.id('ubs'), 'tecnico_enfermagem'), (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'),
  (pg_temp.id('enfu'), pg_temp.id('upa'), 'enfermeiro');

-- ── 1. quem cadastra ────────────────────────────────────────────────────────
SELECT pg_temp.como('ges');
INSERT INTO v SELECT 'penta', to_jsonb(public.vacina_lote_salvar(pg_temp.id('ubs'), 42, ' ab12-3 ', '152', private.data_atual() + 100));
SELECT pg_temp.como('enf');
INSERT INTO v SELECT 'dtpa', to_jsonb(public.vacina_lote_salvar(pg_temp.id('ubs'), 57, 'DT/2026.1', '149', private.data_atual() + 30));
SELECT pg_temp.ok((SELECT lote = 'AB12-3' AND ativo FROM public.vacina_lotes WHERE id = pg_temp.lote('penta')),
  '1. o gestor cadastra (lote em maiúscula, sem espaço)');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.vacina_lotes WHERE id = pg_temp.lote('dtpa')), '1. o enfermeiro cadastra');
SELECT pg_temp.como('tec');
SELECT pg_temp.falha($$SELECT public.vacina_lote_salvar(pg_temp.id('ubs'), 42, 'X1', '152', private.data_atual() + 10)$$,
  'Só o gestor e o enfermeiro', '1. o técnico não cadastra');
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.vacina_lote_salvar(pg_temp.id('ubs'), 42, 'X1', '152', private.data_atual() + 10)$$,
  'Só o gestor e o enfermeiro', '1. a recepção não cadastra');
SELECT pg_temp.como('enfu');
SELECT pg_temp.falha($$SELECT public.vacina_lote_salvar(pg_temp.id('upa'), 42, 'X1', '152', private.data_atual() + 10)$$,
  'Só o gestor e o enfermeiro', '1. fora da UBS, não');
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE entidade_id IN (pg_temp.lote('penta'), pg_temp.lote('dtpa'))) >= 2,
  '1. o cadastro tem auditoria');

-- ── 2. conferências ─────────────────────────────────────────────────────────
SELECT pg_temp.como('ges');
SELECT pg_temp.falha($$SELECT public.vacina_lote_salvar(pg_temp.id('ubs'), 77, 'X1', '152', private.data_atual() + 10)$$,
  'Imunobiológico fora da lista', '2. influenza tetravalente (sem regra no LEDI) não tem lote');
SELECT pg_temp.falha($$SELECT public.vacina_lote_salvar(pg_temp.id('ubs'), 42, 'A B', '152', private.data_atual() + 10)$$,
  'Lote:', '2. lote com espaço é recusado');
SELECT pg_temp.falha($$SELECT public.vacina_lote_salvar(pg_temp.id('ubs'), 42, repeat('A', 31), '152', private.data_atual() + 10)$$,
  'Lote:', '2. lote com mais de 30 caracteres é recusado');
SELECT pg_temp.falha($$SELECT public.vacina_lote_salvar(pg_temp.id('ubs'), 42, 'X1', '1', private.data_atual() + 10)$$,
  'Fabricante fora da lista', '2. fabricante fora da RNDS é recusado');
SELECT pg_temp.falha($$SELECT public.vacina_lote_salvar(pg_temp.id('ubs'), 42, 'X1', '152', private.data_atual() - 1)$$,
  'Informe a validade', '2. validade que passou é recusada');
SELECT pg_temp.falha($$SELECT public.vacina_lote_salvar(pg_temp.id('ubs'), 42, 'ab12-3', '152', private.data_atual() + 50)$$,
  'Este lote já está cadastrado', '2. lote repetido é recusado');

-- ── 3. leitura ──────────────────────────────────────────────────────────────
UPDATE public.vacina_lotes SET validade = private.data_atual() - 1 WHERE id = pg_temp.lote('dtpa');
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'leitura', public.vacina_lotes_da_unidade(pg_temp.id('ubs'));
SELECT pg_temp.ok((SELECT NOT (r ->> 'pode_cadastrar')::boolean AND jsonb_array_length(r -> 'lotes') = 2
                          AND jsonb_array_length(r -> 'imunobiologicos') = 60 AND jsonb_array_length(r -> 'fabricantes') = 98
                     FROM v WHERE nome = 'leitura'),
  '3. a recepção lê os lotes, os 60 imunobiológicos com regra e os 98 fabricantes, e não cadastra');
SELECT pg_temp.ok((SELECT bool_and(CASE x ->> 'lote' WHEN 'DT/2026.1' THEN (x ->> 'vencido')::boolean ELSE NOT (x ->> 'vencido')::boolean END)
                     FROM v, jsonb_array_elements(r -> 'lotes') x WHERE nome = 'leitura'),
  '3. o lote vencido vem marcado');
SELECT pg_temp.como('enf');
SELECT pg_temp.ok((public.vacina_lotes_da_unidade(pg_temp.id('ubs')) ->> 'pode_cadastrar')::boolean, '3. o enfermeiro pode cadastrar');
SELECT pg_temp.como('enfu');
SELECT pg_temp.falha($$SELECT public.vacina_lotes_da_unidade(pg_temp.id('ubs'))$$, 'Acesso negado', '3. quem é de outra unidade não lê');
SELECT pg_temp.como('rec');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM public.vacina_lotes WHERE unidade_id = pg_temp.id('ubs')) = 2, '3. a tabela: quem é da unidade lê');
SELECT pg_temp.falha($$UPDATE public.vacina_lotes SET validade = validade + 1$$, 'permission denied', '3. ninguém grava direto');
RESET ROLE;
SELECT pg_temp.como('enfu');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM public.vacina_lotes WHERE unidade_id = pg_temp.id('ubs')) = 0, '3. a tabela: quem é de fora não lê');
RESET ROLE;

-- ── 5. lote válido (antes de desativar) ─────────────────────────────────────
SELECT pg_temp.ok(private.vacina_lote_valido(pg_temp.lote('penta'), 42, pg_temp.id('ubs'), private.data_atual()), '5. lote ativo na validade');
SELECT pg_temp.ok(NOT private.vacina_lote_valido(pg_temp.lote('penta'), 22, pg_temp.id('ubs'), private.data_atual()), '5. lote de outro imunobiológico');
SELECT pg_temp.ok(NOT private.vacina_lote_valido(pg_temp.lote('penta'), 42, pg_temp.id('upa'), private.data_atual()), '5. lote de outra unidade');
SELECT pg_temp.ok(NOT private.vacina_lote_valido(pg_temp.lote('dtpa'), 57, pg_temp.id('ubs'), private.data_atual()), '5. lote vencido');

-- ── 4. desativar e reativar ─────────────────────────────────────────────────
SELECT pg_temp.como('tec');
SELECT pg_temp.falha($$SELECT public.vacina_lote_desativar(pg_temp.lote('penta'))$$, 'Só o gestor e o enfermeiro', '4. o técnico não desativa');
SELECT pg_temp.como('enf');
SELECT public.vacina_lote_desativar(pg_temp.lote('penta'));
SELECT pg_temp.ok((SELECT NOT ativo FROM public.vacina_lotes WHERE id = pg_temp.lote('penta')), '4. o enfermeiro desativa');
SELECT pg_temp.ok(NOT private.vacina_lote_valido(pg_temp.lote('penta'), 42, pg_temp.id('ubs'), private.data_atual()), '5. lote desativado não vale');
SELECT pg_temp.ok(public.vacina_lote_salvar(pg_temp.id('ubs'), 42, 'AB12-3', '152', private.data_atual() + 200) = pg_temp.lote('penta'),
  '4. cadastrar de novo reativa o mesmo lote');
SELECT pg_temp.ok((SELECT ativo AND validade = private.data_atual() + 200 FROM public.vacina_lotes WHERE id = pg_temp.lote('penta')),
  '4. reativado com a validade nova');

ROLLBACK;
