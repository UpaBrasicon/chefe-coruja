-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270308000001_chegada_regulada_interna.sql (achado P1-1
-- do A01; decisão do RT em 07/11/2026: A em R1 a R6). Tudo em transação com
-- ROLLBACK. O cenário é criado aqui.
--
-- A. leito da rede com reserva: o leito reservado não aparece para outro
--    paciente e o gatilho recusa ocupá-lo (R4); o técnico não confirma; a
--    enfermeira escalada no setor confirma (R5) e a chegada cria o cadastro
--    com a identificação e as alergias da origem, o episódio em internação e
--    a internação no leito reservado, origem "outra_unidade", só com a conta
--    de internação (R1, R2, R3);
-- B. transferência sem reserva: exige um leito livre; o cadastro com o mesmo
--    Cartão SUS é usado (R2, R3);
-- C. provável duplicata (mesmo nome e nascimento): para e pede a escolha;
--    escolhido o cadastro existente, segue (R2);
-- D. leito ocupado não serve;
-- E. consulta regulada: não interna.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000a6f01'),
  ('upa',   '00000000-0000-4000-8000-0000000a6f02'),
  ('hosp',  '00000000-0000-4000-8000-0000000a6f03'),
  ('cent',  '00000000-0000-4000-8000-0000000a6f04'),
  ('porta', '00000000-0000-4000-8000-0000000a6f11'),
  ('cm',    '00000000-0000-4000-8000-0000000a6f13'),
  ('med',   '00000000-0000-4000-8000-0000000a6f21'),
  ('medh',  '00000000-0000-4000-8000-0000000a6f22'),
  ('enfh',  '00000000-0000-4000-8000-0000000a6f23'),
  ('tech',  '00000000-0000-4000-8000-0000000a6f24'),
  ('pA', '00000000-0000-4000-8000-0000000a6f31'), ('rA', '00000000-0000-4000-8000-0000000a6f51'),
  ('pB', '00000000-0000-4000-8000-0000000a6f32'), ('rB', '00000000-0000-4000-8000-0000000a6f52'), ('hB', '00000000-0000-4000-8000-0000000a6f62'),
  ('pC', '00000000-0000-4000-8000-0000000a6f33'), ('rC', '00000000-0000-4000-8000-0000000a6f53'), ('hC', '00000000-0000-4000-8000-0000000a6f63'),
  ('pD', '00000000-0000-4000-8000-0000000a6f34'), ('rD', '00000000-0000-4000-8000-0000000a6f54'),
  ('pE', '00000000-0000-4000-8000-0000000a6f35'), ('rE', '00000000-0000-4000-8000-0000000a6f55'),
  ('hX', '00000000-0000-4000-8000-0000000a6f69');
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
CREATE FUNCTION pg_temp.reg(p text) RETURNS public.regulacao_solicitacoes LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.regulacao_solicitacoes WHERE id = pg_temp.id(p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.reg(text) TO authenticated;
CREATE FUNCTION pg_temp.leito(n int) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.leitos WHERE setor_id = pg_temp.id('cm') AND identificador = 'CM-0' || n $$;
GRANT EXECUTE ON FUNCTION pg_temp.leito(int) TO authenticated;
CREATE FUNCTION pg_temp.chegada_sql(p_reg text, p_leito uuid, p_pac uuid DEFAULT NULL, p_novo boolean DEFAULT false) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.regulacao_marcar_chegada(%L, true, NULL, %L, %L, %L)', pg_temp.id(p_reg), p_leito, p_pac, p_novo) $$;
GRANT EXECUTE ON FUNCTION pg_temp.chegada_sql(text, uuid, uuid, boolean) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@chegadareg.local' FROM ids WHERE nome IN ('med', 'medh', 'enfh', 'tech');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'medh', 'enfh', 'tech')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
UPDATE public.perfis SET crm = '654321', uf_crm = 'SP' WHERE id = pg_temp.id('medh');
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da chegada regulada');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA Origem do teste R', 'upa', '7654701'),
  (pg_temp.id('hosp'), pg_temp.id('org'), 'Hospital Destino do teste R', 'hospital', '7654702'),
  (pg_temp.id('cent'), pg_temp.id('org'), 'Central do teste R', 'hospital', NULL);
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('cm'), pg_temp.id('hosp'), 'Clínica Médica', 'internacao');
INSERT INTO public.leitos (setor_id, identificador) SELECT pg_temp.id('cm'), 'CM-0' || n FROM generate_series(1, 5) n;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('medh'), pg_temp.id('hosp'), 'plantonista'),
  (pg_temp.id('enfh'), pg_temp.id('hosp'), 'enfermeiro'), (pg_temp.id('tech'), pg_temp.id('hosp'), 'tecnico_enfermagem');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT x.u, x.s, x.p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('upa'), pg_temp.id('porta'), pg_temp.id('med')), (pg_temp.id('hosp'), pg_temp.id('cm'), pg_temp.id('medh')),
               (pg_temp.id('hosp'), pg_temp.id('cm'), pg_temp.id('enfh')), (pg_temp.id('hosp'), pg_temp.id('cm'), pg_temp.id('tech'))) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('upa'), pg_temp.id('hosp')) ON CONFLICT DO NOTHING;

-- pacientes da origem (sem atendimento aberto: a origem já está encerrada)
INSERT INTO public.pacientes (id, unidade_id, nome, nome_social, data_nascimento, sexo, nome_mae, cns, cpf) VALUES
  (pg_temp.id('pA'), pg_temp.id('upa'), 'Ana Regulada Teste', 'Aninha', '1950-02-02', 'F', 'Mãe da Ana', '700900000007079', '52998224725'),
  (pg_temp.id('pB'), pg_temp.id('upa'), 'Bruno Regulado Teste', NULL, '1955-03-03', 'M', NULL, '700900000007141', NULL),
  (pg_temp.id('pC'), pg_temp.id('upa'), 'Carla Regulada Teste', NULL, '1960-04-04', 'F', NULL, NULL, NULL),
  (pg_temp.id('pD'), pg_temp.id('upa'), 'Davi Regulado Teste', NULL, '1965-05-05', 'M', NULL, '700900000007281', NULL),
  (pg_temp.id('pE'), pg_temp.id('upa'), 'Eva Regulada Teste', NULL, '1970-06-06', 'F', NULL, '700900000007354', NULL);
INSERT INTO public.alergias_paciente (unidade_id, paciente_id, substancia, substancia_norm, reacao, registrado_por, tipo, gravidade)
VALUES (pg_temp.id('upa'), pg_temp.id('pA'), 'Dipirona', private.norm('Dipirona'), 'urticária', pg_temp.id('med'), 'medicamento', 'grave');
-- no hospital: o mesmo Cartão SUS de B; o mesmo nome e nascimento de C; outro paciente X
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo, cns, prontuario) VALUES
  (pg_temp.id('hB'), pg_temp.id('hosp'), 'Bruno R. Teste', '1955-03-03', 'M', '700900000007141', 'HB-1'),
  (pg_temp.id('hC'), pg_temp.id('hosp'), 'Carla Regulada Teste', '1960-04-04', 'F', NULL, 'HC-1'),
  (pg_temp.id('hX'), pg_temp.id('hosp'), 'Xavier Outro Teste', '1980-01-01', 'M', NULL, 'HX-1');

INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id,
  tipo, procedimento, tipo_leito, transporte, especialidade, cbo, destino_tipo, destino_unidade_id, carater, modalidade,
  prioridade, cid, quadro_clinico, solicitante_id, solicitante_papel, status, autorizada_em, destino_enviado_em)
SELECT pg_temp.id(x.r), pg_temp.id('org'), pg_temp.id('cent'), pg_temp.id('upa'), '7654701', pg_temp.id(x.p),
       x.tipo, '0303060190', x.leito, x.transp, x.esp, x.cbo, 'rede', pg_temp.id('hosp'), 'urgencia', '04', 'urgencia', 'I21.9',
       'Quadro clínico do pedido de teste da chegada regulada.', pg_temp.id('med'), 'medico', x.st, now() - interval '1 hour', now() - interval '1 hour'
  FROM (VALUES ('rA', 'pA', 'leito', 'clinico', NULL, NULL, NULL, 'aguardando_destino'),
               ('rB', 'pB', 'transferencia', NULL, 'ambulancia_avancada', NULL, NULL, 'autorizada'),
               ('rC', 'pC', 'transferencia', NULL, 'ambulancia_avancada', NULL, NULL, 'autorizada'),
               ('rD', 'pD', 'consulta', NULL, NULL, 'Cardiologia', '225120', 'autorizada'),
               ('rE', 'pE', 'transferencia', NULL, 'ambulancia_avancada', NULL, NULL, 'autorizada')) x(r, p, tipo, leito, transp, esp, cbo, st);

SET LOCAL ROLE authenticated;

-- ── A. leito da rede com reserva ────────────────────────────────────────────
SELECT pg_temp.como('medh');
SELECT public.regulacao_destino_aceitar(pg_temp.id('rA'), pg_temp.leito(1), NULL);
RESET ROLE;
SELECT pg_temp.ok((SELECT r.regulacao_id = pg_temp.id('rA') FROM public.reservas_leito r WHERE r.id = (pg_temp.reg('rA')).reserva_id),
  'R4: o aceite marca a reserva com a regulação');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.leitos_para_ocupar(pg_temp.id('cm'), pg_temp.id('hX')) l WHERE l.id = pg_temp.leito(1)),
  'R4: o leito reservado pela regulação não aparece para outro paciente');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.leitos_para_ocupar(pg_temp.id('cm'), pg_temp.id('hX')) l WHERE l.id = pg_temp.leito(2)),
  'R4: os leitos livres continuam aparecendo');
RESET ROLE;
SELECT pg_temp.falha(format($q$INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, tipo_internacao, origem_admissao, status, leito_atual_id, setor_atual_id)
  VALUES (%L, %L, %L, 'urgencia', 'emergencia', 'internado', %L, %L)$q$, pg_temp.id('org'), pg_temp.id('hosp'), pg_temp.id('hX'), pg_temp.leito(1), pg_temp.id('cm')),
  'Leito CM-01 está reservado para outro paciente', 'R4: o gatilho recusa outro paciente no leito reservado');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('tech');
SELECT pg_temp.falha(pg_temp.chegada_sql('rA', NULL), 'Marca a chegada a unidade destino', 'R5: o técnico não confirma a chegada');
SELECT pg_temp.como('enfh');
SELECT public.regulacao_marcar_chegada(pg_temp.id('rA'), true);
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'realizada' AND chegada_por = pg_temp.id('enfh') AND destino_paciente_id IS NOT NULL
                     AND destino_episodio_id IS NOT NULL AND destino_internacao_id IS NOT NULL FROM pg_temp.reg('rA')),
  'R1/R5: a enfermeira do setor confirma; a regulação fica ligada ao cadastro, ao episódio e à internação do destino');
SELECT pg_temp.ok((SELECT p.unidade_id = pg_temp.id('hosp') AND p.nome = 'Ana Regulada Teste' AND p.nome_social = 'Aninha'
                     AND p.data_nascimento = '1950-02-02' AND p.sexo = 'F' AND p.nome_mae = 'Mãe da Ana'
                     AND p.cns = '700900000007079' AND p.cpf = '52998224725'
                     FROM public.pacientes p WHERE p.id = (pg_temp.reg('rA')).destino_paciente_id),
  'R2: cadastro novo no destino com a identificação da origem');
SELECT pg_temp.ok((SELECT a.fonte LIKE 'Informada pela origem, regulação nº %' AND a.gravidade = 'grave' AND a.reacao LIKE 'urticária%'
                     FROM public.alergias_paciente a WHERE a.paciente_id = (pg_temp.reg('rA')).destino_paciente_id AND a.substancia = 'Dipirona'),
  'R2: a alergia da origem vem, marcada como informada pela origem');
SELECT pg_temp.ok((SELECT e.etapa = 'internacao' AND e.regulacao_id = pg_temp.id('rA') AND e.unidade_id = pg_temp.id('hosp')
                     FROM public.episodios e WHERE e.id = (pg_temp.reg('rA')).destino_episodio_id),
  'R1: episódio do destino já em internação');
SELECT pg_temp.ok((SELECT i.status = 'internado' AND i.origem_admissao = 'outra_unidade' AND i.leito_atual_id = pg_temp.leito(1)
                     AND i.internado_em IS NOT NULL FROM public.internacoes i WHERE i.id = (pg_temp.reg('rA')).destino_internacao_id),
  'R1/R3: internado no leito reservado, origem outra unidade');
SELECT pg_temp.ok((SELECT status::text = 'ocupado' FROM public.leitos WHERE id = pg_temp.leito(1))
                  AND (SELECT situacao = 'ocupada' AND internacao_id = (pg_temp.reg('rA')).destino_internacao_id
                         FROM public.reservas_leito WHERE id = (pg_temp.reg('rA')).reserva_id),
  'R3: o leito ficou ocupado e a reserva, ocupada pela internação');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.contas WHERE episodio_id = (pg_temp.reg('rA')).destino_episodio_id AND tipo = 'ambulatorial')
                  AND EXISTS (SELECT 1 FROM public.contas WHERE internacao_id = (pg_temp.reg('rA')).destino_internacao_id AND tipo = 'internacao'),
  'R1: sem conta de porta; a conta de internação abre');
SET LOCAL ROLE authenticated;

-- ── B. transferência sem reserva, cadastro pelo Cartão SUS ──────────────────
SELECT pg_temp.como('medh');
SELECT pg_temp.falha(pg_temp.chegada_sql('rB', NULL), 'Sem leito reservado: escolha um leito livre do setor', 'R3: sem reserva, a chegada exige o leito');
SELECT public.regulacao_marcar_chegada(pg_temp.id('rB'), true, NULL, pg_temp.leito(2));
RESET ROLE;
SELECT pg_temp.ok((SELECT destino_paciente_id = pg_temp.id('hB') FROM pg_temp.reg('rB'))
                  AND (SELECT count(*) FROM public.pacientes WHERE unidade_id = pg_temp.id('hosp') AND cns = '700900000007141') = 1,
  'R2: o cadastro do destino com o mesmo Cartão SUS é usado; nenhum novo');
SELECT pg_temp.ok((SELECT leito_atual_id = pg_temp.leito(2) FROM public.internacoes WHERE id = (pg_temp.reg('rB')).destino_internacao_id),
  'R3: internado no leito escolhido');
SET LOCAL ROLE authenticated;

-- ── C. provável duplicata ───────────────────────────────────────────────────
SELECT pg_temp.falha(pg_temp.chegada_sql('rC', pg_temp.leito(3)), 'CHEGADA_DUPLICATA_PROVAVEL:' || pg_temp.id('hC'),
  'R2: mesmo nome e nascimento sem documento: para e pede a escolha');
SELECT public.regulacao_marcar_chegada(pg_temp.id('rC'), true, NULL, pg_temp.leito(3), pg_temp.id('hC'));
RESET ROLE;
SELECT pg_temp.ok((SELECT destino_paciente_id = pg_temp.id('hC') FROM pg_temp.reg('rC')), 'R2: escolhido o cadastro existente, segue');
SET LOCAL ROLE authenticated;

-- ── D. leito ocupado ────────────────────────────────────────────────────────
SELECT pg_temp.falha(pg_temp.chegada_sql('rE', pg_temp.leito(1)), 'O leito escolhido não está livre', 'leito ocupado não serve para a chegada');

-- ── E. consulta ─────────────────────────────────────────────────────────────
SELECT public.regulacao_marcar_chegada(pg_temp.id('rD'), true);
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'realizada' AND destino_internacao_id IS NULL AND destino_paciente_id IS NULL FROM pg_temp.reg('rD')),
  'consulta regulada: a chegada não interna');
ROLLBACK;
