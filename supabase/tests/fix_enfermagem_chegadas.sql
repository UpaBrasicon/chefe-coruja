-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270308000007_enfermagem_chegadas.sql (item 16 do teste
-- da rede: a enfermagem vê a chegada regulada no leito reservado). Tudo em
-- transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. a enfermeira escalada na Clínica Médica vê a chegada com leito reservado
--    no setor dela: paciente, origem, número, leito, saída e alergias; pode
--    confirmar;
-- 2. não vê a reservada em outro setor (UTI) nem a transferência sem reserva;
-- 3. o técnico vê, mas não pode confirmar; quem não é da enfermagem não lê;
-- 4. E2: a enfermeira não registra "não chegou";
-- 5. confirmada a chegada, a linha some.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000a7e01'),
  ('upa',   '00000000-0000-4000-8000-0000000a7e02'),
  ('hosp',  '00000000-0000-4000-8000-0000000a7e03'),
  ('cent',  '00000000-0000-4000-8000-0000000a7e04'),
  ('porta', '00000000-0000-4000-8000-0000000a7e11'),
  ('cm',    '00000000-0000-4000-8000-0000000a7e12'),
  ('uti',   '00000000-0000-4000-8000-0000000a7e13'),
  ('cm1',   '00000000-0000-4000-8000-0000000a7e14'),
  ('uti1',  '00000000-0000-4000-8000-0000000a7e15'),
  ('med',   '00000000-0000-4000-8000-0000000a7e21'),
  ('medh',  '00000000-0000-4000-8000-0000000a7e22'),
  ('enfh',  '00000000-0000-4000-8000-0000000a7e23'),
  ('tech',  '00000000-0000-4000-8000-0000000a7e24'),
  ('enfu',  '00000000-0000-4000-8000-0000000a7e25'),
  ('pA', '00000000-0000-4000-8000-0000000a7e31'), ('rA', '00000000-0000-4000-8000-0000000a7e51'),
  ('pU', '00000000-0000-4000-8000-0000000a7e32'), ('rU', '00000000-0000-4000-8000-0000000a7e52'),
  ('pB', '00000000-0000-4000-8000-0000000a7e33'), ('rB', '00000000-0000-4000-8000-0000000a7e53');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@chegadaenf.local' FROM ids WHERE nome IN ('med', 'medh', 'enfh', 'tech', 'enfu');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'medh', 'enfh', 'tech', 'enfu')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
UPDATE public.perfis SET crm = '654323', uf_crm = 'SP' WHERE id = pg_temp.id('medh');
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da chegada pela enfermagem');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA Origem do teste E', 'upa', '7655001'),
  (pg_temp.id('hosp'), pg_temp.id('org'), 'Hospital Destino do teste E', 'hospital', '7655002'),
  (pg_temp.id('cent'), pg_temp.id('org'), 'Central do teste E', 'hospital', NULL);
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('cm'), pg_temp.id('hosp'), 'Clínica Médica', 'internacao'),
  (pg_temp.id('uti'), pg_temp.id('hosp'), 'UTI Adulto', 'uti');
INSERT INTO public.leitos (id, setor_id, identificador) VALUES
  (pg_temp.id('cm1'), pg_temp.id('cm'), 'CM-01'), (pg_temp.id('uti1'), pg_temp.id('uti'), 'UTI-01');
INSERT INTO public.leitos (setor_id, identificador) VALUES (pg_temp.id('cm'), 'CM-02');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('medh'), pg_temp.id('hosp'), 'plantonista'),
  (pg_temp.id('enfh'), pg_temp.id('hosp'), 'enfermeiro'), (pg_temp.id('tech'), pg_temp.id('hosp'), 'tecnico_enfermagem'),
  (pg_temp.id('enfu'), pg_temp.id('hosp'), 'enfermeiro');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT x.u, x.s, x.p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('upa'), pg_temp.id('porta'), pg_temp.id('med')), (pg_temp.id('hosp'), pg_temp.id('cm'), pg_temp.id('medh')),
               (pg_temp.id('hosp'), pg_temp.id('cm'), pg_temp.id('enfh')), (pg_temp.id('hosp'), pg_temp.id('cm'), pg_temp.id('tech')),
               (pg_temp.id('hosp'), pg_temp.id('uti'), pg_temp.id('enfu'))) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('upa'), pg_temp.id('hosp')) ON CONFLICT DO NOTHING;

INSERT INTO public.pacientes (id, unidade_id, nome, nome_social, data_nascimento, sexo, cns) VALUES
  (pg_temp.id('pA'), pg_temp.id('upa'), 'Ana Chegada Teste', 'Aninha', '1950-02-02', 'F', '700900000007079'),
  (pg_temp.id('pU'), pg_temp.id('upa'), 'Ugo Chegada Teste', NULL, '1955-03-03', 'M', '700900000007141'),
  (pg_temp.id('pB'), pg_temp.id('upa'), 'Bia Chegada Teste', NULL, '1960-04-04', 'F', '700900000007281');
INSERT INTO public.alergias_paciente (unidade_id, paciente_id, substancia, substancia_norm, reacao, registrado_por, tipo, gravidade)
VALUES (pg_temp.id('upa'), pg_temp.id('pA'), 'Dipirona', private.norm('Dipirona'), 'urticária', pg_temp.id('med'), 'medicamento', 'grave');

INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
  tipo, procedimento, tipo_leito, transporte, destino_tipo, destino_unidade_id, carater, modalidade,
  prioridade, cid, quadro_clinico, solicitante_id, solicitante_papel, status, autorizada_em, destino_enviado_em)
SELECT pg_temp.id(x.r), pg_temp.id('org'), pg_temp.id('cent'), pg_temp.id('upa'), '7655001', pg_temp.id(x.p),
       x.tipo, '0303060190', x.leito, x.transp, 'rede', pg_temp.id('hosp'), 'urgencia', '04', 'urgencia', 'I21.9',
       'Quadro clínico do pedido de teste da chegada pela enfermagem.', pg_temp.id('med'), 'medico', x.st, now() - interval '1 hour', now() - interval '1 hour'
  FROM (VALUES ('rA', 'pA', 'leito', 'clinico', NULL, 'aguardando_destino'),
               ('rU', 'pU', 'leito', 'uti_adulto', NULL, 'aguardando_destino'),
               ('rB', 'pB', 'transferencia', NULL, 'ambulancia_avancada', 'autorizada')) x(r, p, tipo, leito, transp, st);

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('medh');
SELECT public.regulacao_destino_aceitar(pg_temp.id('rA'), pg_temp.id('cm1'), NULL);
SELECT public.regulacao_destino_aceitar(pg_temp.id('rU'), pg_temp.id('uti1'), NULL);
RESET ROLE;
-- o paciente de A saiu da origem
UPDATE public.regulacao_solicitacoes SET status = 'em_transito', saida_em = now() - interval '10 minutes' WHERE id = pg_temp.id('rA');
SET LOCAL ROLE authenticated;

-- ── 1 e 2. a enfermeira da Clínica Médica ───────────────────────────────────
SELECT pg_temp.como('enfh');
CREATE TEMP TABLE vistas ON COMMIT DROP AS SELECT * FROM public.enfermagem_chegadas(pg_temp.id('hosp'));
SELECT pg_temp.ok((SELECT count(*) = 1 FROM vistas WHERE regulacao_id = pg_temp.id('rA') AND leito_id = pg_temp.id('cm1')
                     AND leito = 'CM-01' AND setor_id = pg_temp.id('cm') AND nome = 'Aninha' AND sexo = 'F'
                     AND origem = 'UPA Origem do teste E' AND status = 'em_transito' AND saida_em IS NOT NULL
                     AND alergias = ARRAY['Dipirona'] AND pode_confirmar),
  '1: a enfermeira vê a chegada no leito reservado do setor dela, com a saída e as alergias, e pode confirmar');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM vistas WHERE regulacao_id IN (pg_temp.id('rU'), pg_temp.id('rB'))),
  '2: não vê a reservada em outro setor nem a transferência sem leito reservado');

-- ── 3. o técnico e quem não é da enfermagem ─────────────────────────────────
SELECT pg_temp.como('tech');
SELECT pg_temp.ok((SELECT count(*) = 1 AND NOT bool_or(pode_confirmar) FROM public.enfermagem_chegadas(pg_temp.id('hosp'))),
  '3: o técnico vê a chegada, mas não pode confirmar');
SELECT pg_temp.como('enfu');
SELECT pg_temp.ok((SELECT array_agg(regulacao_id) = ARRAY[pg_temp.id('rU')] FROM public.enfermagem_chegadas(pg_temp.id('hosp'))),
  '3: a enfermeira da UTI vê só a chegada da UTI');
SELECT pg_temp.como('medh');
SELECT pg_temp.falha(format('SELECT * FROM public.enfermagem_chegadas(%L)', pg_temp.id('hosp')),
  'Acesso negado', '3: quem não é da enfermagem não lê as chegadas da enfermagem');

-- ── 4. E2: "não chegou" não é da enfermagem ─────────────────────────────────
SELECT pg_temp.como('enfh');
SELECT pg_temp.falha(format('SELECT public.regulacao_marcar_chegada(%L, false, %L)', pg_temp.id('rA'), 'O paciente não veio, a família desistiu.'),
  'Marca a chegada a unidade destino', '4: a enfermeira não registra "não chegou"');

-- ── 5. confirmada a chegada, a linha some ───────────────────────────────────
SELECT public.regulacao_marcar_chegada(pg_temp.id('rA'), true);
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.enfermagem_chegadas(pg_temp.id('hosp')) WHERE regulacao_id = pg_temp.id('rA')),
  '5: confirmada a chegada, a linha some');
RESET ROLE;
ROLLBACK;
