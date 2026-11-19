-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000030_ubs_u15_ficha_vacinacao.sql (Percurso da
-- UBS, U15, vacina, PR 6). Tudo em transação com ROLLBACK; o cenário é criado
-- aqui.
--
-- 1. a vacina registrada entra na fila como 'fv', com o uuid prefixado pelo CNES;
-- 2. a carga: unidade, profissional, cidadão e a vacina; profissional com CBO
--    fora da Tabela 12 fica retido;
-- 3. ledi_dados_ficha monta a 'fv';
-- 4. vacina cancelada antes do envio: ficha descartada;
-- 5. a conferência noturna enfileira a vacina do dia que ficou fora.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000123a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000123a2'),
  ('enf',  '00000000-0000-4000-8000-0000000123b1'),
  ('asb',  '00000000-0000-4000-8000-0000000123b2'),
  ('pac',  '00000000-0000-4000-8000-0000000123c1');
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.vac(p_autor text, p_registrado timestamptz DEFAULT now()) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.vacinacoes (unidade_id, paciente_id, registro_anterior, data_aplicacao, imunobiologico, dose, via, local,
                                 registrado_por, registrado_em)
  VALUES (pg_temp.id('ubs'), pg_temp.id('pac'), true, date '2026-03-10', 9, 1, 3, 18, pg_temp.id(p_autor), p_registrado) RETURNING id $$;
CREATE FUNCTION pg_temp.fila(p uuid) RETURNS public.ledi_fila LANGUAGE sql AS $$
  SELECT * FROM public.ledi_fila WHERE tipo = 'fv' AND referencia_id = p ORDER BY criado_em DESC LIMIT 1 $$;
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15fv.local' FROM ids WHERE nome IN ('enf', 'asb');
INSERT INTO public.perfis (id, nome_completo, cns, cbo) VALUES
  (pg_temp.id('enf'), 'Enfermeira FV', '700000000000005', '223505'),
  (pg_temp.id('asb'), 'Auxiliar FV', '700000000000013', '322415')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, cns = EXCLUDED.cns, cbo = EXCLUDED.cbo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15 FV');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U15 FV', 'ubs', '9912345');
INSERT INTO public.ledi_config_unidade (unidade_id, codigo_ibge, pec_url) VALUES (pg_temp.id('ubs'), '3550308', 'https://pec.exemplo.gov.br');
INSERT INTO public.pacientes (id, unidade_id, nome, sexo, data_nascimento, cpf) VALUES
  (pg_temp.id('pac'), pg_temp.id('ubs'), 'Paciente FV', 'M', date '1990-01-01', '52998224725');

-- ── 1. fila ─────────────────────────────────────────────────────────────────
INSERT INTO v VALUES ('hb', pg_temp.vac('enf'));
SELECT pg_temp.ok((pg_temp.fila(pg_temp.v('hb'))).status = 'pendente' AND (pg_temp.fila(pg_temp.v('hb'))).uuid_ficha LIKE '9912345-%',
  '1. a vacina registrada entra na fila (fv), com o CNES no uuid');

-- ── 2. carga ────────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT j @> '{"unidade": {"cnes": "9912345", "codigo_ibge": "3550308"}, "profissional": {"cbo": "223505"},
                                  "cidadao": {"cpf": "52998224725"}, "vacina": {"imunobiologico": 9, "dose": 1, "registro_anterior": true, "via": 3, "local": 18}}'
                     FROM (SELECT private.ledi_carga_fv(pg_temp.v('hb')) AS j) x),
  '2. a carga traz unidade, profissional, cidadão e a vacina');
INSERT INTO v VALUES ('asb', pg_temp.vac('asb'));
DO $$ BEGIN
  PERFORM private.ledi_carga_fv(pg_temp.v('asb'));
  RAISE EXCEPTION 'FALHOU: 2. CBO fora da Tabela 12 — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'retido: CBO do profissional fora da Tabela 12%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  2. CBO fora da Tabela 12 fica retido';
END $$;

-- ── 3. ledi_dados_ficha ─────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT j @> '{"tipo": "fv", "envio": {"pec_url": "https://pec.exemplo.gov.br"}, "carga": {"vacina": {"imunobiologico": 9}}}'
                     FROM (SELECT public.ledi_dados_ficha((pg_temp.fila(pg_temp.v('hb'))).id) AS j) x),
  '3. o serviço recebe a carga da Ficha de Vacinação');

-- ── 4. cancelada antes do envio ─────────────────────────────────────────────
UPDATE public.vacinacoes SET cancelado_em = now(), cancelado_por = pg_temp.id('enf'), motivo_cancelamento = 'lançada por engano'
 WHERE id = pg_temp.v('asb');
SELECT pg_temp.ok((pg_temp.fila(pg_temp.v('asb'))).status = 'descartado', '4. vacina cancelada: ficha descartada');
SELECT pg_temp.ok((pg_temp.fila(pg_temp.v('hb'))).status = 'pendente', '4. a outra ficha segue na fila');

-- ── 5. conferência noturna ──────────────────────────────────────────────────
INSERT INTO v VALUES ('ontem', pg_temp.vac('enf', ((private.data_atual() - 1)::timestamp + interval '10 hours') AT TIME ZONE 'America/Sao_Paulo'));
DELETE FROM public.ledi_fila WHERE tipo = 'fv' AND referencia_id = pg_temp.v('ontem');
SELECT pg_temp.ok((private.ledi_conferencia_noturna(private.data_atual() - 1) ->> 'fv')::int = 1
                  AND (pg_temp.fila(pg_temp.v('ontem'))).status = 'pendente',
  '5. a conferência noturna enfileira a vacina do dia que ficou fora');

ROLLBACK;
