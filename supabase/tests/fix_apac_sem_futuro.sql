-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270308000005_apac_sem_futuro.sql (achado C P2-C2 do
-- teste da rede; A em F1 e F2). Tudo em transação com ROLLBACK. O cenário é
-- criado aqui; a APAC já nasce autorizada, com validade até daqui a 3 meses.
--
-- F1. competência depois da atual (mês de Brasília): recusada, mesmo dentro
--     da validade da APAC;
-- F2. data de ocorrência no futuro: recusada;
-- a competência atual e a anterior, com data de hoje ou passada, seguem.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0204030153', 'EXAME DE ALTA COMPLEXIDADE DO TESTE', '3', 'I', 0, 1571, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT (codigo) DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento_registro (procedimento, registro, competencia) VALUES ('0204030153', '06', '202609') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento_ocupacao (procedimento, cbo, competencia) VALUES ('0204030153', '225125', '202609') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('C50.9', 'CID do teste C50.9') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.cbo (codigo, titulo) VALUES ('225125', 'Médico clínico') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000aae01'),
  ('hosp', '00000000-0000-4000-8000-0000000aae02'),
  ('fat',  '00000000-0000-4000-8000-0000000aae21'),
  ('med',  '00000000-0000-4000-8000-0000000aae22'),
  ('pac',  '00000000-0000-4000-8000-0000000aae31'),
  ('apac', '00000000-0000-4000-8000-0000000aae41');
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
-- competência a "n" meses do mês atual de Brasília
CREATE FUNCTION pg_temp.comp(n int) RETURNS text LANGUAGE sql AS $$
  SELECT to_char(private.data_atual() + make_interval(months => n), 'YYYYMM') $$;
GRANT EXECUTE ON FUNCTION pg_temp.comp(int) TO authenticated;
CREATE FUNCTION pg_temp.exec_sql(p_comp text, p_data date) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.registrar_execucao_apac(%L, %L, %L, %L, %L, %L, %L)', pg_temp.id('apac'), p_comp, '01', '21', p_data,
                pg_temp.id('med'), '[{"procedimento": "0204030153", "quantidade": 1}]') $$;
GRANT EXECUTE ON FUNCTION pg_temp.exec_sql(text, date) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@apacfut.local' FROM ids WHERE nome IN ('fat', 'med');
INSERT INTO public.perfis (id, nome_completo, cbo) VALUES
  (pg_temp.id('fat'), 'Pessoa fat', NULL), (pg_temp.id('med'), 'Pessoa med', '225125')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, cbo = EXCLUDED.cbo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da APAC sem futuro');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES (pg_temp.id('hosp'), pg_temp.id('org'), 'Hospital da APAC sem futuro', 'hospital', '7654801');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('fat'), pg_temp.id('hosp'), 'faturamento'), (pg_temp.id('med'), pg_temp.id('hosp'), 'plantonista');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo)
VALUES (pg_temp.id('pac'), pg_temp.id('hosp'), 'Paciente da APAC sem futuro', '1970-02-20', 'AF-1', 'F');
INSERT INTO public.apacs (id, unidade_id, paciente_id, tipo, procedimento, cid_principal, carater, status, numero,
                          validade_inicio, validade_fim, solicitada_por, decidida_por, decidida_em)
VALUES (pg_temp.id('apac'), pg_temp.id('hosp'), pg_temp.id('pac'), '1', '0204030153', 'C50.9', '01', 'autorizada', '3526100000099',
        date_trunc('month', private.data_atual() - interval '1 month')::date,
        (date_trunc('month', private.data_atual() + interval '3 months') + interval '1 month - 1 day')::date,
        pg_temp.id('med'), pg_temp.id('med'), now());

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('fat');

-- ── F1: competência no futuro ───────────────────────────────────────────────
SELECT pg_temp.falha(pg_temp.exec_sql(pg_temp.comp(1), NULL), 'Competência no futuro',
  'F1: competência do mês que vem é recusada, mesmo dentro da validade da APAC');

-- ── F2: data de ocorrência no futuro ────────────────────────────────────────
SELECT pg_temp.falha(pg_temp.exec_sql(pg_temp.comp(0), private.data_atual() + 1), 'Data de ocorrência no futuro',
  'F2: data de ocorrência de amanhã é recusada');

-- ── o que segue valendo ─────────────────────────────────────────────────────
SELECT pg_temp.ok(public.registrar_execucao_apac(pg_temp.id('apac'), pg_temp.comp(0), '01', '21', private.data_atual(), pg_temp.id('med'),
                    '[{"procedimento": "0204030153", "quantidade": 1}]') IS NOT NULL, 'competência atual, com data de hoje: aceita');
SELECT pg_temp.ok(public.registrar_execucao_apac(pg_temp.id('apac'), pg_temp.comp(-1), '01', '21', NULL, pg_temp.id('med'),
                    '[{"procedimento": "0204030153", "quantidade": 1}]') IS NOT NULL, 'competência anterior, sem data: aceita');
ROLLBACK;
