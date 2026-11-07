-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270303000001_dini_pediatrico.sql (classificação de
-- pacientes pediátricos de Dini; decisão do RT: A em D1 a D7, 06/11/2026).
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. quem não é enfermeiro é recusado;
-- 2. indicador faltando, fora de 1 a 4 ou estranho é recusado;
-- 3. D5: 14 anos completos no dia é recusado no Dini (véspera aceita); sem
--    data de nascimento também; menor de 14 anos continua recusado no Fugulin;
-- 4. o servidor refaz a soma e a categoria, nos limites 17/18, 23/24, 30/31,
--    36/37 e em 11 e 44;
-- 5. a segunda do dia sem motivo é recusada; com motivo é retificação;
-- 6. UPDATE e DELETE na tabela são recusados; só por RPC; fora do anon;
-- 7. dini_de_hoje, dini_da_internacao e a leitura da tabela respeitam a unidade;
-- 8. auditoria: cada registro deixa linha na trilha; a cobertura conta o Dini.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',     '00000000-0000-4000-8000-0000000d1a01'),
  ('upa',     '00000000-0000-4000-8000-0000000d1a02'),
  ('outra',   '00000000-0000-4000-8000-0000000d1a03'),
  ('setor',   '00000000-0000-4000-8000-0000000d1a04'),
  ('setor2',  '00000000-0000-4000-8000-0000000d1a05'),
  ('enf',     '00000000-0000-4000-8000-0000000d1b01'),
  ('med',     '00000000-0000-4000-8000-0000000d1b02'),
  ('enfx',    '00000000-0000-4000-8000-0000000d1b03'),
  ('ges',     '00000000-0000-4000-8000-0000000d1b04'),
  ('p6',      '00000000-0000-4000-8000-0000000d1c01'),
  ('p14',     '00000000-0000-4000-8000-0000000d1c02'),
  ('pvesp',   '00000000-0000-4000-8000-0000000d1c03'),
  ('psem',    '00000000-0000-4000-8000-0000000d1c04'),
  ('i6',      '00000000-0000-4000-8000-0000000d1d01'),
  ('i14',     '00000000-0000-4000-8000-0000000d1d02'),
  ('ivesp',   '00000000-0000-4000-8000-0000000d1d03'),
  ('isem',    '00000000-0000-4000-8000-0000000d1d04');
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
CREATE TEMP TABLE v (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
-- respostas com a mesma situação em todos os indicadores
CREATE FUNCTION pg_temp.resp(n int) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_object_agg(a, n) FROM jsonb_array_elements_text(private.dini_definicao() -> 'indicadores') a $$;
GRANT EXECUTE ON FUNCTION pg_temp.resp(int) TO authenticated;
-- respostas que somam exatamente p_total (11 a 44): sobe um indicador por vez
CREATE FUNCTION pg_temp.soma(p_total int) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb := '{}'::jsonb; a text; falta int := p_total - 11; sobe int;
BEGIN
  FOR a IN SELECT jsonb_array_elements_text(private.dini_definicao() -> 'indicadores') LOOP
    sobe := least(3, falta);
    r := r || jsonb_build_object(a, 1 + sobe);
    falta := falta - sobe;
  END LOOP;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.soma(int) TO authenticated;
CREATE FUNCTION pg_temp.fugulin(n int) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_object_agg(a, n) FROM jsonb_array_elements_text(private.fugulin_definicao() -> 'areas') a $$;
GRANT EXECUTE ON FUNCTION pg_temp.fugulin(int) TO authenticated;
GRANT EXECUTE ON FUNCTION private.dini_definicao() TO authenticated;
GRANT EXECUTE ON FUNCTION private.fugulin_definicao() TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@dini.local' FROM ids WHERE nome IN ('enf', 'med', 'enfx', 'ges');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('enf', 'med', 'enfx', 'ges')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do Dini');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do Dini', 'upa'),
  (pg_temp.id('outra'), pg_temp.id('org'), 'UPA vizinha do Dini', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('setor'), pg_temp.id('upa'), 'Pediatria', 'internacao'),
  (pg_temp.id('setor2'), pg_temp.id('outra'), 'Pediatria vizinha', 'internacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('enf'), pg_temp.id('upa'), 'enfermeiro'), (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('ges'), pg_temp.id('upa'), 'gestor'), (pg_temp.id('enfx'), pg_temp.id('outra'), 'enfermeiro');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT u, s, pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('upa'), pg_temp.id('setor'), 'enf'), (pg_temp.id('upa'), pg_temp.id('setor'), 'med'),
               (pg_temp.id('outra'), pg_temp.id('setor2'), 'enfx')) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('upa'), pg_temp.id('outra')) ON CONFLICT DO NOTHING;

-- crianças de 6 anos, de 14 anos completos hoje, na véspera dos 14 e sem data
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo, setor_id) VALUES
  (pg_temp.id('p6'), pg_temp.id('upa'), 'Criança Dini Seis', (private.data_atual() - interval '6 years')::date, 'F', pg_temp.id('setor')),
  (pg_temp.id('p14'), pg_temp.id('upa'), 'Criança Dini Quatorze', (private.data_atual() - interval '14 years')::date, 'M', pg_temp.id('setor')),
  (pg_temp.id('pvesp'), pg_temp.id('upa'), 'Criança Dini Véspera', (private.data_atual() - interval '14 years' + interval '1 day')::date, 'F', pg_temp.id('setor')),
  (pg_temp.id('psem'), pg_temp.id('upa'), 'Criança Dini Sem Data', NULL, 'M', pg_temp.id('setor'));
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao)
SELECT pg_temp.id(i), pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id(p), 'internado', pg_temp.id('setor'), now() - interval '1 day'
  FROM (VALUES ('i6', 'p6'), ('i14', 'p14'), ('ivesp', 'pvesp'), ('isem', 'psem')) x(i, p);
INSERT INTO v SELECT 'seq0', coalesce(max(seq), 0)::text FROM public.log_auditoria;

SET LOCAL ROLE authenticated;

-- ── 1. papel ────────────────────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L)', pg_temp.id('i6'), pg_temp.resp(2)),
  'O Dini é do enfermeiro de plantão', 'médico não classifica pelo Dini');
SELECT pg_temp.como('enfx');
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L)', pg_temp.id('i6'), pg_temp.resp(2)),
  'O Dini é do enfermeiro de plantão', 'enfermeiro de outra unidade não classifica');

-- ── 2. respostas ───────────────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L)', pg_temp.id('i6'), pg_temp.resp(2) - 'rede_apoio'),
  'Responda os 11 indicadores com situação de 1 a 4 (falta ou inválida: rede_apoio)', 'indicador faltando: recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L)', pg_temp.id('i6'), pg_temp.resp(2) || '{"oxigenacao":5}'),
  'Responda os 11 indicadores com situação de 1 a 4 (falta ou inválida: oxigenacao)', 'situação 5: recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L)', pg_temp.id('i6'), pg_temp.resp(2) || '{"oxigenacao":0}'),
  'Responda os 11 indicadores com situação de 1 a 4 (falta ou inválida: oxigenacao)', 'situação 0: recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L)', pg_temp.id('i6'), pg_temp.resp(2) || '{"oxigenacao":"2"}'),
  'Responda os 11 indicadores com situação de 1 a 4 (falta ou inválida: oxigenacao)', 'situação em texto: recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L)', pg_temp.id('i6'), pg_temp.resp(2) || '{"total":44}'),
  'Indicador que não é do Dini', 'indicador estranho (total vindo da tela): recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, NULL)', pg_temp.id('i6')),
  'Responda os 11 indicadores', 'sem respostas: recusado');

-- ── 3. D5: corte de 14 anos pela data de nascimento no dia ─────────────────
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L)', pg_temp.id('i14'), pg_temp.resp(2)),
  'Dini é instrumento da criança', '14 anos completos hoje: Dini recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L)', pg_temp.id('isem'), pg_temp.resp(2)),
  'Sem data de nascimento no cadastro', 'sem data de nascimento: Dini recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_fugulin(%L, %L)', pg_temp.id('i6'), pg_temp.fugulin(2)),
  'Fugulin é instrumento do adulto', 'menor de 14 anos continua recusado no Fugulin');
INSERT INTO v SELECT 'vesp', public.registrar_dini(pg_temp.id('ivesp'), pg_temp.resp(4))::text;

-- ── 4 e 5. soma no servidor; a segunda do dia é retificação com motivo ─────
INSERT INTO v SELECT 'd17', public.registrar_dini(pg_temp.id('i6'), pg_temp.soma(17))::text;
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L)', pg_temp.id('i6'), pg_temp.soma(18)),
  'O Dini de hoje já foi feito', 'segunda do dia sem motivo: recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_dini(%L, %L, %L)', pg_temp.id('i6'), pg_temp.soma(18), 'curto'),
  'O Dini de hoje já foi feito', 'motivo com menos de 10 letras: recusado');
INSERT INTO v SELECT 'd18', public.registrar_dini(pg_temp.id('i6'), pg_temp.soma(18), 'Retificação de teste para a soma 18')::text;
INSERT INTO v SELECT 'd23', public.registrar_dini(pg_temp.id('i6'), pg_temp.soma(23), 'Retificação de teste para a soma 23')::text;
INSERT INTO v SELECT 'd24', public.registrar_dini(pg_temp.id('i6'), pg_temp.soma(24), 'Retificação de teste para a soma 24')::text;
INSERT INTO v SELECT 'd30', public.registrar_dini(pg_temp.id('i6'), pg_temp.soma(30), 'Retificação de teste para a soma 30')::text;
INSERT INTO v SELECT 'd31', public.registrar_dini(pg_temp.id('i6'), pg_temp.soma(31), 'Retificação de teste para a soma 31')::text;
INSERT INTO v SELECT 'd36', public.registrar_dini(pg_temp.id('i6'), pg_temp.soma(36), 'Retificação de teste para a soma 36')::text;
INSERT INTO v SELECT 'd37', public.registrar_dini(pg_temp.id('i6'), pg_temp.soma(37), 'Retificação de teste para a soma 37')::text;
INSERT INTO v SELECT 'd11', public.registrar_dini(pg_temp.id('i6'), pg_temp.soma(11), 'Retificação de teste para a soma 11')::text;
INSERT INTO v SELECT 'hist', public.dini_da_internacao(pg_temp.id('i6'))::text;
INSERT INTO v SELECT 'hoje', public.dini_de_hoje(ARRAY[pg_temp.id('i6'), pg_temp.id('ivesp'), pg_temp.id('i14')])::text;
INSERT INTO v SELECT 've_enf', count(*)::text FROM public.classificacoes_dini WHERE internacao_id = pg_temp.id('i6');

-- ── 7. outra unidade não lê ───────────────────────────────────────────────
SELECT pg_temp.como('enfx');
INSERT INTO v SELECT 'hoje_x', public.dini_de_hoje(ARRAY[pg_temp.id('i6'), pg_temp.id('ivesp')])::text;
INSERT INTO v SELECT 've_x', count(*)::text FROM public.classificacoes_dini WHERE internacao_id = pg_temp.id('i6');
SELECT pg_temp.falha(format('SELECT public.dini_da_internacao(%L)', pg_temp.id('i6')),
  'Acesso negado', 'histórico do Dini: outra unidade não lê');
SELECT pg_temp.como('ges');
INSERT INTO v SELECT 'cob', public.cobertura_auditoria_clinica(pg_temp.id('upa'), 1)::text;
RESET ROLE;

DO $$
DECLARE
  h jsonb := pg_temp.v('hist')::jsonb; hj jsonb := pg_temp.v('hoje')::jsonb; hx jsonb := pg_temp.v('hoje_x')::jsonb;
  c jsonb := pg_temp.v('cob')::jsonb; t int; esperado text;
BEGIN
  -- 4. soma e categoria do servidor, nos limites
  FOR t, esperado IN SELECT * FROM (VALUES
      (11, 'Cuidados mínimos (11 a 17)'), (17, 'Cuidados mínimos (11 a 17)'),
      (18, 'Cuidados intermediários (18 a 23)'), (23, 'Cuidados intermediários (18 a 23)'),
      (24, 'Alta dependência (24 a 30)'), (30, 'Alta dependência (24 a 30)'),
      (31, 'Cuidados semi-intensivos (31 a 36)'), (36, 'Cuidados semi-intensivos (31 a 36)'),
      (37, 'Cuidados intensivos (37 a 44)')) x(t, e) LOOP
    PERFORM pg_temp.ok((SELECT total = t AND categoria = esperado AND versao = '2026-11-06.1'
                          FROM public.classificacoes_dini WHERE id = pg_temp.v('d' || t)::uuid),
                       format('servidor soma %s e lê "%s"', t, esperado));
  END LOOP;
  PERFORM pg_temp.ok((SELECT total = 44 AND categoria = 'Cuidados intensivos (37 a 44)' FROM public.classificacoes_dini WHERE id = pg_temp.v('vesp')::uuid),
    'véspera dos 14 anos: ainda criança, Dini aceito (44, intensivos)');
  -- 5. retificação
  PERFORM pg_temp.ok((SELECT retifica_id = pg_temp.v('d17')::uuid AND motivo = 'Retificação de teste para a soma 18'
                        FROM public.classificacoes_dini WHERE id = pg_temp.v('d18')::uuid),
    'com motivo, a segunda do dia retifica a anterior e guarda o motivo');
  PERFORM pg_temp.ok(jsonb_array_length(h) = 9 AND (h -> 0 ->> 'id') = pg_temp.v('d11') AND NOT (h -> 0 ->> 'retificada')::boolean
                     AND (SELECT count(*) FROM jsonb_array_elements(h) x WHERE (x ->> 'retificada')::boolean) = 8,
    'histórico: as 9 do dia, só a última vigente');
  -- 7. hoje, por unidade
  PERFORM pg_temp.ok((hj -> pg_temp.id('i6')::text ->> 'total')::int = 11
                     AND (hj -> pg_temp.id('ivesp')::text ->> 'total')::int = 44 AND jsonb_typeof(hj -> pg_temp.id('i14')::text) = 'null',
    'Dini de hoje: vigente nas classificadas; pendente (nulo) na outra');
  PERFORM pg_temp.ok(hx = '{}'::jsonb, 'Dini de hoje: outra unidade recebe vazio');
  PERFORM pg_temp.ok(pg_temp.v('ve_enf')::int = 9 AND pg_temp.v('ve_x')::int = 0, 'tabela: a unidade lê, a outra unidade não');
  -- 8. auditoria
  PERFORM pg_temp.ok((SELECT count(*) FROM public.log_auditoria a JOIN public.classificacoes_dini d ON d.id = a.entidade_id
                       WHERE a.seq > pg_temp.v('seq0')::bigint AND a.acao = 'dini_registrado' AND a.entidade = 'classificacoes_dini'
                         AND a.payload ->> 'versao' = '2026-11-06.1') = 10,
    'cada Dini deixa linha na trilha (versão no payload)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE seq > pg_temp.v('seq0')::bigint AND payload::text ~ '(Retificação|Criança)'),
    'trilha sem motivo nem nome');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(c -> 'eventos') e
                              WHERE e ->> 'evento' = 'Classificação pediátrica (Dini)' AND (e ->> 'registros')::int = 10 AND (e ->> 'sem_trilha')::int = 0)
                     AND EXISTS (SELECT 1 FROM jsonb_array_elements(c -> 'eventos') e WHERE e ->> 'evento' = 'Escalas e Fugulin'),
    'cobertura conta o Dini, sem tirar as linhas que já existiam');
  -- 6. só de inserção
  BEGIN
    UPDATE public.classificacoes_dini SET total = 11 WHERE id = pg_temp.v('d37')::uuid;
    RAISE EXCEPTION 'FALHOU: alterada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  UPDATE recusado';
  BEGIN
    DELETE FROM public.classificacoes_dini WHERE id = pg_temp.v('d37')::uuid;
    RAISE EXCEPTION 'FALHOU: apagada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  DELETE recusado';
  PERFORM pg_temp.ok(NOT has_table_privilege('authenticated', 'public.classificacoes_dini', 'INSERT')
                     AND NOT has_table_privilege('authenticated', 'public.classificacoes_dini', 'UPDATE')
                     AND NOT has_table_privilege('authenticated', 'public.classificacoes_dini', 'DELETE')
                     AND NOT has_table_privilege('anon', 'public.classificacoes_dini', 'INSERT')
                     AND NOT has_function_privilege('anon', 'public.registrar_dini(uuid, jsonb, text)', 'EXECUTE')
                     AND NOT has_function_privilege('anon', 'public.dini_da_internacao(uuid)', 'EXECUTE')
                     AND NOT has_function_privilege('anon', 'public.dini_de_hoje(uuid[])', 'EXECUTE'),
    'só por RPC; fora do anon');
END $$;
ROLLBACK;
