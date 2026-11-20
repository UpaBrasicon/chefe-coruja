-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000031_ubs_u15_ria_rnds.sql (Percurso da UBS,
-- U15, vacina, PR 7). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. a vacina registrada entra na fila da RNDS como 'ria';
-- 2. a UBS que manda a RNDS pelo PEC não enfileira (VC6 = A);
-- 3. a carga nos códigos da RNDS: via, local, estratégia, grupo, validade do
--    lote; transcrição com "sem registro"; condição maternal 1 no masculino;
-- 4. rnds_dados_documento devolve o 'ria';
-- 5. cancelada antes do envio: descartada.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000125a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000125a2'),
  ('ubs2', '00000000-0000-4000-8000-0000000125a3'),
  ('enf',  '00000000-0000-4000-8000-0000000125b1'),
  ('pac',  '00000000-0000-4000-8000-0000000125c1'),
  ('pac2', '00000000-0000-4000-8000-0000000125c2'),
  ('lote', '00000000-0000-4000-8000-0000000125d1');
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.item(p uuid) RETURNS public.interop_outbox LANGUAGE sql AS $$
  SELECT * FROM public.interop_outbox WHERE tipo_documento = 'ria' AND referencia_id = p ORDER BY created_at DESC LIMIT 1 $$;
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15ria.local' FROM ids WHERE nome = 'enf';
INSERT INTO public.perfis (id, nome_completo, cns, cbo) VALUES (pg_temp.id('enf'), 'Enfermeira RIA', '700000000000005', '223505')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, cns = EXCLUDED.cns, cbo = EXCLUDED.cbo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15 RIA');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U15 RIA', 'ubs', '9912345'),
  (pg_temp.id('ubs2'), pg_temp.id('org'), 'UBS pelo PEC', 'ubs', '9912346');
INSERT INTO public.rnds_config_unidade (unidade_id, financiamento) VALUES (pg_temp.id('ubs'), '07'), (pg_temp.id('ubs2'), '07');
UPDATE public.rnds_config_unidade SET rac_aps_pelo = 'pec' WHERE unidade_id = pg_temp.id('ubs2');
INSERT INTO public.pacientes (id, unidade_id, nome, sexo, data_nascimento, cpf) VALUES
  (pg_temp.id('pac'), pg_temp.id('ubs'), 'Paciente RIA', 'M', date '1990-01-01', '52998224725'),
  (pg_temp.id('pac2'), pg_temp.id('ubs2'), 'Paciente PEC', 'F', date '1991-01-01', NULL);
INSERT INTO public.vacina_lotes (id, unidade_id, imunobiologico, lote, fabricante, validade, criado_por)
VALUES (pg_temp.id('lote'), pg_temp.id('ubs'), 57, 'DTPA01', '149', date '2027-06-30', pg_temp.id('enf'));

-- ── 1. fila ─────────────────────────────────────────────────────────────────
WITH x AS (
  INSERT INTO public.vacinacoes (unidade_id, paciente_id, registro_anterior, data_aplicacao, imunobiologico, estrategia, dose,
    lote_id, lote, fabricante, grupo_atendimento, via, local, registrado_por)
  VALUES (pg_temp.id('ubs'), pg_temp.id('pac'), false, private.data_atual(), 57, 1, 8, pg_temp.id('lote'), 'DTPA01', '149', 121, 3, 2, pg_temp.id('enf'))
  RETURNING id)
INSERT INTO v SELECT 'aplicada', id FROM x;
SELECT pg_temp.ok((pg_temp.item(pg_temp.v('aplicada'))).status = 'pendente', '1. a vacina aplicada entra na fila da RNDS (ria)');

-- ── 2. UBS pelo PEC ─────────────────────────────────────────────────────────
WITH x AS (
  INSERT INTO public.vacinacoes (unidade_id, paciente_id, registro_anterior, data_aplicacao, imunobiologico, dose, via, local,
    condicao_maternal, registrado_por)
  VALUES (pg_temp.id('ubs2'), pg_temp.id('pac2'), true, date '2020-01-01', 33, 9, 3, 2, 1, pg_temp.id('enf')) RETURNING id)
INSERT INTO v SELECT 'pec', id FROM x;
SELECT pg_temp.ok((pg_temp.item(pg_temp.v('pec'))).id IS NULL, '2. na UBS que manda a RNDS pelo PEC, o app não enfileira o RIA');

-- ── 3. carga ────────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT j #> '{vacina}' @> '{"imunobiologico": "57", "dose": "8", "estrategia": "1", "grupo_atendimento": "000210",
                                              "via": "10890", "local": "1", "fabricante": "149", "lote": "DTPA01",
                                              "validade": "2027-06-30", "condicao_maternal": "1", "registro_anterior": false}'
                          AND j #>> '{paciente,cpf}' = '52998224725' AND j #>> '{estabelecimento,cnes}' = '9912345'
                          AND j #>> '{profissional,cns}' = '700000000000005'
                     FROM (SELECT private.rnds_carga_ria(pg_temp.v('aplicada')) AS j) x),
  '3. a carga vem nos códigos da RNDS (via, local, estratégia, grupo) com a validade do lote e a condição 1 no masculino');
WITH x AS (
  INSERT INTO public.vacinacoes (unidade_id, paciente_id, registro_anterior, data_aplicacao, imunobiologico, dose, via, local, registrado_por)
  VALUES (pg_temp.id('ubs'), pg_temp.id('pac'), true, date '1990-01-02', 9, 1, 3, 18, pg_temp.id('enf')) RETURNING id)
INSERT INTO v SELECT 'anterior', id FROM x;
SELECT pg_temp.ok((SELECT j #> '{vacina}' @> '{"registro_anterior": true, "estrategia": "0", "grupo_atendimento": "00", "local": "3"}'
                          AND j #>> '{vacina,lote}' IS NULL
                     FROM (SELECT private.rnds_carga_ria(pg_temp.v('anterior')) AS j) x),
  '3. a transcrição vai sem lote e com "sem registro" no grupo e na estratégia');

-- ── 4. rnds_dados_documento ─────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT j ->> 'tipo' = 'ria' AND j #>> '{dados,vacina,imunobiologico}' = '57'
                          AND j #>> '{envio,profissional_cns}' = '700000000000005'
                     FROM (SELECT public.rnds_dados_documento((pg_temp.item(pg_temp.v('aplicada'))).id) AS j) x),
  '4. o serviço de envio recebe a carga do RIA e o CNS de quem assina');

-- ── 5. cancelada ────────────────────────────────────────────────────────────
UPDATE public.vacinacoes SET cancelado_em = now(), cancelado_por = pg_temp.id('enf'), motivo_cancelamento = 'lançada por engano'
 WHERE id = pg_temp.v('anterior');
SELECT pg_temp.ok((pg_temp.item(pg_temp.v('anterior'))).status = 'descartado', '5. vacina cancelada antes do envio: item descartado');
SELECT pg_temp.ok((pg_temp.item(pg_temp.v('aplicada'))).status = 'pendente', '5. a outra segue na fila');

ROLLBACK;
