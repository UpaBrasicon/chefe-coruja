-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270421000080 (boletim bimestral do Gestor da
-- secretaria, metas do contrato e a linha de cada unidade na Rede; pedidos do
-- RT de 24/11/2026). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. boletim: a secretaria abre a unidade dela e a rede dela; o administrador
--    da organização abre a unidade; gestor de unidade, secretaria de outra
--    unidade e administrador de outra organização não;
-- 2. as contas de um mês: fichas, atendidas, turno, tempos, tempo-alvo,
--    retorno em 72 h, estabilização (sem evento ADT: o setor atual),
--    enfermaria com alta, óbito antes de 24 h e a taxa de transferência;
--    número exato, sem "< 5";
-- 3. metas do contrato: a secretaria e o administrador gravam; vigência
--    sobreposta é recusada; o gestor da unidade só lê; o boletim traz a meta;
-- 4. Rede: a linha da unidade conta a pessoa uma vez, não o vínculo, e traz
--    leitos ocupados e regulações vencidas com número exato (migration
--    20270422000095, decisão do RT de 25/11/2026).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('orgA',  '00000000-0000-4000-8000-0000000080a1'),
  ('orgB',  '00000000-0000-4000-8000-0000000080a2'),
  ('upaA',  '00000000-0000-4000-8000-0000000080a3'),
  ('hosA',  '00000000-0000-4000-8000-0000000080a4'),
  ('cliA',  '00000000-0000-4000-8000-0000000080a5'),
  ('upaB',  '00000000-0000-4000-8000-0000000080a6'),
  ('admA',  '00000000-0000-4000-8000-0000000080a7'),
  ('admB',  '00000000-0000-4000-8000-0000000080a8'),
  ('gest',  '00000000-0000-4000-8000-0000000080a9'),
  ('seca',  '00000000-0000-4000-8000-0000000080aa'),
  ('secd',  '00000000-0000-4000-8000-0000000080ab'),
  ('med',   '00000000-0000-4000-8000-0000000080ac'),
  ('s1',    '00000000-0000-4000-8000-0000000080b1'),
  ('s2',    '00000000-0000-4000-8000-0000000080b2'),
  ('sB',    '00000000-0000-4000-8000-0000000080b3'),
  ('sPorta','00000000-0000-4000-8000-0000000080c1'),
  ('sEstab','00000000-0000-4000-8000-0000000080c2'),
  ('sEnf',  '00000000-0000-4000-8000-0000000080c3'),
  ('sPed',  '00000000-0000-4000-8000-0000000080c4'),
  ('p1',    '00000000-0000-4000-8000-0000000080d1'),
  ('p2',    '00000000-0000-4000-8000-0000000080d2'),
  ('p3',    '00000000-0000-4000-8000-0000000080d3'),
  ('p4',    '00000000-0000-4000-8000-0000000080d4'),
  ('p5',    '00000000-0000-4000-8000-0000000080d5'),
  ('e0',    '00000000-0000-4000-8000-0000000080e0'),
  ('e1',    '00000000-0000-4000-8000-0000000080e1'),
  ('e2',    '00000000-0000-4000-8000-0000000080e2'),
  ('e3',    '00000000-0000-4000-8000-0000000080e3'),
  ('e4',    '00000000-0000-4000-8000-0000000080e4'),
  ('iEst',  '00000000-0000-4000-8000-0000000080f1'),
  ('iEnf',  '00000000-0000-4000-8000-0000000080f2'),
  ('iObi',  '00000000-0000-4000-8000-0000000080f3');
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

-- ── cenário ───────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email, email_confirmed_at)
SELECT id, lower(nome) || '@boletim.local', now() FROM ids WHERE nome IN ('admA', 'admB', 'gest', 'seca', 'secd', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('admA', 'admB', 'gest', 'seca', 'secd', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
UPDATE public.perfis SET conselho = 'CRM', registro_numero = '12345', registro_uf = 'GO' WHERE id = pg_temp.id('med');
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('orgA'), 'Rede A boletim'), (pg_temp.id('orgB'), 'Rede B boletim');
INSERT INTO public.secretarias (id, organizacao_id, nome) VALUES
  (pg_temp.id('s1'), pg_temp.id('orgA'), 'Secretaria Um boletim'),
  (pg_temp.id('s2'), pg_temp.id('orgA'), 'Secretaria Dois boletim'),
  (pg_temp.id('sB'), pg_temp.id('orgB'), 'Secretaria da B boletim');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, secretaria_id) VALUES
  (pg_temp.id('upaA'), pg_temp.id('orgA'), 'UPA A boletim', 'upa', pg_temp.id('s1')),
  (pg_temp.id('hosA'), pg_temp.id('orgA'), 'Hospital A boletim', 'hospital', pg_temp.id('s1')),
  (pg_temp.id('cliA'), pg_temp.id('orgA'), 'Clínica A boletim', 'clinica', pg_temp.id('s2')),
  (pg_temp.id('upaB'), pg_temp.id('orgB'), 'UPA B boletim', 'upa', pg_temp.id('sB'));
-- med tem dois papéis na UPA A: dois vínculos, uma pessoa
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('admA'), pg_temp.id('upaA'), 'admin'),
  (pg_temp.id('admB'), pg_temp.id('upaB'), 'admin'),
  (pg_temp.id('gest'), pg_temp.id('upaA'), 'gestor'),
  (pg_temp.id('med'),  pg_temp.id('upaA'), 'plantonista'),
  (pg_temp.id('med'),  pg_temp.id('upaA'), 'recepcao');
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem, publico, estabilizacao) VALUES
  (pg_temp.id('sPorta'), pg_temp.id('upaA'), 'Porta boletim', 'emergencia', 1, 'todos', false),
  (pg_temp.id('sEstab'), pg_temp.id('upaA'), 'Sala vermelha boletim', 'uti', 2, 'todos', true),
  (pg_temp.id('sEnf'),   pg_temp.id('upaA'), 'Enfermaria adulto boletim', 'internacao', 3, 'adulto', false),
  (pg_temp.id('sPed'),   pg_temp.id('upaA'), 'Enfermaria pediátrica boletim', 'internacao', 4, 'pediatrico', false);
INSERT INTO public.leitos (setor_id, identificador, tipo, status) VALUES
  (pg_temp.id('sEstab'), 'E01', 'estabilizacao', 'ocupado'),
  (pg_temp.id('sEstab'), 'E02', 'estabilizacao', 'livre'),
  (pg_temp.id('sEnf'),   'N01', 'clinico', 'livre'),
  (pg_temp.id('sEnf'),   'N02', 'clinico', 'livre'),
  (pg_temp.id('sPed'),   'P01', 'clinico', 'livre');

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
SELECT id, pg_temp.id('upaA'), 'Paciente boletim ' || nome, '1970-01-01', 'T-BOL-' || nome, pg_temp.id('sPorta'), 'M'
  FROM ids WHERE nome IN ('p1', 'p2', 'p3', 'p4', 'p5');

-- outubro de 2026 (horário de Brasília):
--   e0: p1, 01/10 08:00 (diurno, adulto), verde, médico 09:00 (no alvo), alta às 12:00
--   e1: p1, 03/10 10:00 (diurno, adulto), classificada 10:05 amarelo, médico 10:20 (no alvo);
--       retorno: a ficha e0 do mesmo paciente terminou 46 h antes
--   e2: p2, 05/10 22:00 (noturno, pediátrico), classificada 22:10 laranja, médico 22:15 (no alvo)
--   e3: p3, 06/10 03:00 (noturno, adulto), classificada 03:10 verde, sem médico (não atendida)
--   e4: p4, 07/10 09:00 (diurno, adulto), classificada 09:05 laranja, médico 09:40 (fora do alvo de 10 min)
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, publico,
                              cor_atual, classificado_em, atendimento_iniciado_em, desfecho, desfecho_em, encerrado_em) VALUES
  (pg_temp.id('e0'), pg_temp.id('upaA'), pg_temp.id('p1'), pg_temp.id('sPorta'), 'encerrado', 'Dor', pg_temp.id('med'),
   '2026-10-01 08:00-03', 'adulto', 'verde', '2026-10-01 08:10-03', '2026-10-01 09:00-03', 'alta', '2026-10-01 12:00-03', '2026-10-01 12:00-03'),
  (pg_temp.id('e1'), pg_temp.id('upaA'), pg_temp.id('p1'), pg_temp.id('sPorta'), 'atendimento', 'Dor', pg_temp.id('med'),
   '2026-10-03 10:00-03', 'adulto', 'amarelo', '2026-10-03 10:05-03', '2026-10-03 10:20-03', NULL, NULL, NULL),
  (pg_temp.id('e2'), pg_temp.id('upaA'), pg_temp.id('p2'), pg_temp.id('sPorta'), 'atendimento', 'Febre', pg_temp.id('med'),
   '2026-10-05 22:00-03', 'pediatrico', 'laranja', '2026-10-05 22:10-03', '2026-10-05 22:15-03', NULL, NULL, NULL),
  (pg_temp.id('e3'), pg_temp.id('upaA'), pg_temp.id('p3'), pg_temp.id('sPorta'), 'atendimento', 'Tosse', pg_temp.id('med'),
   '2026-10-06 03:00-03', 'adulto', 'verde', '2026-10-06 03:10-03', NULL, NULL, NULL, NULL),
  (pg_temp.id('e4'), pg_temp.id('upaA'), pg_temp.id('p4'), pg_temp.id('sPorta'), 'atendimento', 'Dor torácica', pg_temp.id('med'),
   '2026-10-07 09:00-03', 'adulto', 'laranja', '2026-10-07 09:05-03', '2026-10-07 09:40-03', NULL, NULL, NULL);

-- internações sem evento ADT: ficam inteiras no setor atual
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, data_alta, cid_principal)
VALUES
  -- estabilização: entrou em outubro e segue internada
  (pg_temp.id('iEst'), pg_temp.id('orgA'), pg_temp.id('upaA'), pg_temp.id('p4'), 'internado', pg_temp.id('sEstab'),
   '2026-10-07 10:00-03', NULL, 'I21.9'),
  -- enfermaria adulto: entrou em setembro, alta em outubro (anterior + saída)
  (pg_temp.id('iEnf'), pg_temp.id('orgA'), pg_temp.id('upaA'), pg_temp.id('p3'), 'alta_melhorada', pg_temp.id('sEnf'),
   '2026-09-28 10:00-03', '2026-10-02 10:00-03', 'J18.9'),
  -- estabilização com óbito 10 h depois da admissão
  (pg_temp.id('iObi'), pg_temp.id('orgA'), pg_temp.id('upaA'), pg_temp.id('p5'), 'obito', pg_temp.id('sEstab'),
   '2026-10-12 08:00-03', '2026-10-12 18:00-03', 'A41.9');
INSERT INTO public.obitos (unidade_id, paciente_id, internacao_id, origem, setor_id, hora_obito, tipo_morte, encaminhamento, causa_a, registrado_por)
VALUES (pg_temp.id('upaA'), pg_temp.id('p5'), pg_temp.id('iObi'), 'internacao', pg_temp.id('sEstab'), '2026-10-12 18:00-03',
        'natural_sem_assistencia_ou_a_esclarecer', 'svo', NULL, pg_temp.id('med'));

SET LOCAL ROLE authenticated;

-- as pessoas da secretaria Um (seca) e da Dois (secd)
SELECT pg_temp.como('admA');
SELECT public.admin_designar_secretaria(pg_temp.id('s1'), 'seca@boletim.local');
SELECT public.admin_designar_secretaria(pg_temp.id('s2'), 'secd@boletim.local');

-- ── 1. acesso ─────────────────────────────────────────────────────────────
SELECT pg_temp.como('seca');
CREATE TEMP TABLE bol ON COMMIT DROP AS
  SELECT public.secretaria_boletim(pg_temp.id('upaA'), '2026-09-01', '2026-10-15') AS j;
SELECT pg_temp.ok((SELECT jsonb_array_length(j -> 'meses') = 2 AND (j -> 'meses' -> 1 ->> 'mes') = '2026-10-01'
                          AND (j ->> 'rede')::boolean = false AND (j ->> 'estabilizacao_marcada')::boolean FROM bol),
  'a secretaria abre o boletim da unidade dela; o mês vem pelo primeiro dia');
SELECT pg_temp.ok((SELECT jsonb_array_length(public.secretaria_boletim(NULL, '2026-09-01', '2026-10-01') -> 'unidades') = 2),
  'toda a rede: as duas unidades da secretaria Um');
SELECT pg_temp.falha($$SELECT public.secretaria_boletim(pg_temp.id('cliA'), '2026-09-01', '2026-10-01')$$,
  'O boletim é de quem cuida', 'a secretaria não abre unidade de outra secretaria');
SELECT pg_temp.falha($$SELECT public.secretaria_boletim(pg_temp.id('upaA'), NULL, '2026-10-01')$$, 'Mês inválido', 'mês vazio é recusado');
SELECT pg_temp.como('admA');
SELECT pg_temp.ok((SELECT jsonb_array_length(public.secretaria_boletim(pg_temp.id('upaA'), '2026-09-01', '2026-10-01') -> 'meses') = 2),
  'o administrador da organização abre o boletim da unidade');
SELECT pg_temp.como('admB');
SELECT pg_temp.falha($$SELECT public.secretaria_boletim(pg_temp.id('upaA'), '2026-09-01', '2026-10-01')$$,
  'O boletim é de quem cuida', 'administrador de outra organização não abre');
SELECT pg_temp.como('gest');
SELECT pg_temp.falha($$SELECT public.secretaria_boletim(pg_temp.id('upaA'), '2026-09-01', '2026-10-01')$$,
  'O boletim é de quem cuida', 'gestor de unidade não abre o boletim da secretaria');
SELECT pg_temp.falha($$SELECT public.secretaria_boletim(NULL, '2026-09-01', '2026-10-01')$$,
  'O boletim é de quem cuida', 'gestor de unidade não abre a rede');

-- ── 2. as contas de outubro ───────────────────────────────────────────────
SELECT pg_temp.ok((SELECT (m -> 'porta' ->> 'fichas')::int = 5 AND (m -> 'porta' ->> 'atendidas')::int = 4
                          AND (m -> 'porta' ->> 'nao_atendidas')::int = 1 AND (m -> 'porta' ->> 'taxa_atendimento')::numeric = 80.0
                     FROM bol, LATERAL (SELECT j -> 'meses' -> 1 AS m) x),
  'fichas, atendidas, não atendidas e taxa, com número exato');
SELECT pg_temp.ok((SELECT (t ->> 'adulto_diurno')::int = 3 AND (t ->> 'pediatrico_noturno')::int = 1
                          AND (t ->> 'adulto_noturno')::int = 0 AND (t ->> 'pediatrico_diurno')::int = 0
                     FROM bol, LATERAL (SELECT j -> 'meses' -> 1 -> 'porta' -> 'turnos' AS t) x),
  'atendidas por público e turno (07:00 a 19:00)');
SELECT pg_temp.ok((SELECT (a ->> 'avaliados')::int = 4 AND (a ->> 'dentro')::int = 3 AND (a ->> 'pct')::numeric = 75.0
                     FROM bol, LATERAL (SELECT j -> 'meses' -> 1 -> 'porta' -> 'no_alvo' AS a) x),
  'atendidos no tempo-alvo da cor: 3 de 4');
SELECT pg_temp.ok((SELECT (j -> 'meses' -> 1 -> 'porta' -> 'retorno_72h' ->> 'retornos')::int = 1 FROM bol),
  'retorno em 72 h: a ficha do paciente que teve alta 46 h antes');
SELECT pg_temp.ok((SELECT (e ->> 'novas')::int = 2 AND (e ->> 'anteriores')::int = 0 AND (e ->> 'leitos')::int = 2
                          AND (e -> 'origem' ->> 'emergencia')::int = 2
                     FROM bol, LATERAL (SELECT j -> 'meses' -> 1 -> 'internacao' -> 'estabilizacao' AS e) x),
  'estabilização: duas internações novas, vindas da emergência');
SELECT pg_temp.ok((SELECT (e ->> 'anteriores')::int = 1 AND (e ->> 'saidas')::int = 1 AND (e ->> 'novas')::int = 0
                     FROM bol, LATERAL (SELECT j -> 'meses' -> 1 -> 'internacao' -> 'enfermaria_adulto' AS e) x),
  'enfermaria adulto: a internação de setembro conta como anterior e sai em outubro');
SELECT pg_temp.ok((SELECT (j -> 'meses' -> 0 -> 'internacao' -> 'enfermaria_adulto' ->> 'novas')::int = 1 FROM bol),
  'em setembro, a mesma internação é nova');
SELECT pg_temp.ok((SELECT (o ->> 'total')::int = 1 AND (o ->> 'estabilizacao')::int = 1 AND (o ->> 'ate_24h')::int = 1
                          AND (o -> 'causas' -> 'estabilizacao' -> 0 ->> 'causa') = 'SVO'
                          AND (o -> 'causas' -> 'estabilizacao' -> 0 ->> 'n')::int = 1
                     FROM bol, LATERAL (SELECT j -> 'meses' -> 1 -> 'obitos' AS o) x),
  'óbito na estabilização antes de 24 h, causa SVO com número exato');
SELECT pg_temp.ok((SELECT j::text NOT LIKE '%Paciente boletim%' AND j::text NOT LIKE '%' || pg_temp.id('p1')::text || '%' FROM bol),
  'o boletim não traz nome nem id de paciente');

-- ── 3. metas do contrato ──────────────────────────────────────────────────
SELECT pg_temp.como('seca');
CREATE TEMP TABLE meta ON COMMIT DROP AS
  SELECT public.salvar_meta_contrato(pg_temp.id('upaA'), 'taxa_atendimento', 95, 'maior', '2026-01-01') AS id;
SELECT pg_temp.falha($$SELECT public.salvar_meta_contrato(pg_temp.id('upaA'), 'taxa_atendimento', 90, 'maior', '2026-06-01')$$,
  'Já existe meta deste indicador', 'vigência sobreposta é recusada');
SELECT pg_temp.ok((SELECT public.salvar_meta_contrato(pg_temp.id('upaA'), 'taxa_atendimento', 96, 'maior', '2026-01-01',
                                                      (SELECT id FROM meta), 10, '2026-12-31') = (SELECT id FROM meta)),
  'a secretaria muda a própria meta (peso e fim da vigência)');
SELECT pg_temp.falha($$SELECT public.salvar_meta_contrato(pg_temp.id('cliA'), 'taxa_atendimento', 95, 'maior', '2026-01-01')$$,
  'As metas do contrato são', 'a secretaria não grava meta de unidade de outra secretaria');
SELECT pg_temp.falha($$SELECT public.salvar_meta_contrato(pg_temp.id('upaA'), 'Taxa Errada', 95, 'maior', '2026-01-01')$$,
  'Indicador inválido', 'chave de indicador fora do padrão é recusada');
SELECT pg_temp.ok((SELECT (m ->> 'meta')::numeric = 96 AND (m ->> 'sentido') = 'maior'
                     FROM jsonb_array_elements(public.secretaria_boletim(pg_temp.id('upaA'), '2026-09-01', '2026-10-01') -> 'metas') m
                    WHERE m ->> 'indicador' = 'taxa_atendimento'),
  'o boletim traz a meta vigente');
SELECT pg_temp.como('gest');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.metas_contrato WHERE unidade_id = pg_temp.id('upaA')),
  'o gestor da unidade lê as metas');
SELECT pg_temp.falha($$SELECT public.salvar_meta_contrato(pg_temp.id('upaA'), 'retorno_72h', 6, 'menor', '2026-01-01')$$,
  'As metas do contrato são', 'o gestor da unidade não grava meta');
SELECT pg_temp.falha($$INSERT INTO public.metas_contrato (unidade_id, indicador, meta, sentido, vigente_de, criado_por)
                       VALUES (pg_temp.id('upaA'), 'retorno_72h', 6, 'menor', '2026-01-01', pg_temp.id('gest'))$$,
  'permission denied', 'ninguém grava direto na tabela');
SELECT pg_temp.como('admB');
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.metas_contrato WHERE unidade_id = pg_temp.id('upaA')),
  'administrador de outra organização não lê as metas');
SELECT pg_temp.como('admA');
SELECT pg_temp.ok((SELECT public.salvar_meta_contrato(pg_temp.id('upaA'), 'retorno_72h', 6, 'menor', '2026-01-01') IS NOT NULL),
  'o administrador da organização grava meta');
SELECT public.remover_meta_contrato((SELECT id FROM meta));
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.metas_contrato WHERE unidade_id = pg_temp.id('upaA')),
  'o administrador remove a meta');

-- ── 4. Rede: pessoa uma vez ───────────────────────────────────────────────
SELECT pg_temp.como('seca');
SELECT pg_temp.ok((SELECT (u ->> 'pessoas')::int = 3 AND (u ->> 'leitos')::int = 5
                          AND (u ->> 'ocupados')::int = 1 AND (u ->> 'ocupacao')::numeric = 20.0  -- número exato (RT, 25/11; migration 20270422000095)
                          AND (u ->> 'regulacoes_vencidas')::int = 0
                     FROM jsonb_array_elements(public.secretaria_estado_unidades()) u WHERE (u ->> 'id')::uuid = pg_temp.id('upaA')),
  'a linha da Rede conta a pessoa uma vez (4 vínculos, 3 pessoas) e traz 1 ocupado com número exato');
SELECT pg_temp.ok((SELECT jsonb_array_length(public.secretaria_estado_unidades()) = 2),
  'a linha da Rede: as duas unidades da secretaria');
SELECT pg_temp.como('gest');
SELECT pg_temp.falha($$SELECT public.secretaria_estado_unidades()$$,
  'O estado das unidades é de quem cuida', 'gestor de unidade não lê a linha da Rede da secretaria');

-- ── auditoria ─────────────────────────────────────────────────────────────
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) = 3 FROM public.log_auditoria WHERE acao = 'meta_contrato_salva'
                     AND unidade_id = pg_temp.id('upaA')),
  'auditoria das metas gravadas');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.log_auditoria WHERE acao = 'meta_contrato_removida'
                     AND unidade_id = pg_temp.id('upaA')),
  'auditoria da meta removida');

SELECT 'secretaria_boletim ok' AS resultado;
ROLLBACK;
