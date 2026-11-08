-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270306000001_encerrado_sem_escala.sql (achado D P1-1
-- do teste de rede, D10; decisão do RT em 07/11/2026: A em P1 a P4,
-- docs/teste-rede/PRIVACIDADE-ENCERRADO-DIAGNOSTICO.md). Tudo em transação com
-- ROLLBACK. O cenário é criado aqui.
--
-- "Em cuidado no plantão" é atendimento aberto ou internação aberta num setor
-- da minha escala, não mais o setor que ficou gravado no cadastro.
-- 1. recusado: quem está escalado no último setor não atua no paciente
--    encerrado há 3 dias (médico e farmacêutico da porta, técnico e médico da
--    UBS); o farmacêutico não abre o prontuário;
-- 2. ok: o técnico da UBS pede acesso ao cadastro encerrado (antes: "Você já tem
--    acesso a este paciente pela escala");
-- 3. continua: atendimento aberto no setor dá cuidado (escrita) e leitura;
--    nas 24 h depois do encerramento a equipe do setor lê, mas não escreve;
--    o gestor lê.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',     '00000000-0000-4000-8000-0000000b0e01'),
  ('upa',     '00000000-0000-4000-8000-0000000b0e02'),
  ('ubs',     '00000000-0000-4000-8000-0000000b0e03'),
  ('porta',   '00000000-0000-4000-8000-0000000b0e11'),
  ('consult', '00000000-0000-4000-8000-0000000b0e12'),
  ('med',     '00000000-0000-4000-8000-0000000b0e21'),  -- plantonista na porta da UPA
  ('farm',    '00000000-0000-4000-8000-0000000b0e22'),  -- farmacêutico na porta da UPA
  ('gestor',  '00000000-0000-4000-8000-0000000b0e23'),  -- gestor da UPA, sem escala
  ('tec',     '00000000-0000-4000-8000-0000000b0e24'),  -- técnico de enfermagem na UBS
  ('medubs',  '00000000-0000-4000-8000-0000000b0e25'),  -- médico na UBS
  ('velho',   '00000000-0000-4000-8000-0000000b0e31'),  -- UPA: encerrado há 3 dias
  ('recente', '00000000-0000-4000-8000-0000000b0e32'),  -- UPA: encerrado há 2 horas
  ('aberto',  '00000000-0000-4000-8000-0000000b0e33'),  -- UPA: atendimento aberto
  ('pubs',    '00000000-0000-4000-8000-0000000b0e34');  -- UBS: consulta encerrada há 3 dias
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
-- as funções de acesso, avaliadas para um login (claims do JWT)
CREATE FUNCTION pg_temp.atua(p_quem text, p_pac text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_temp.como(p_quem); RETURN private.pode_atuar_no_paciente(pg_temp.id(p_pac)); END $$;
CREATE FUNCTION pg_temp.cuida(p_quem text, p_pac text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_temp.como(p_quem); RETURN private.paciente_em_cuidado_no_plantao(pg_temp.id(p_pac)); END $$;

INSERT INTO auth.users (id, email) SELECT id, nome || '@fixpriv.local' FROM ids WHERE nome IN ('med', 'farm', 'gestor', 'tec', 'medubs');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'farm', 'gestor', 'tec', 'medubs')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do fix da privacidade');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do fix da privacidade', 'upa'),
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do fix da privacidade', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('consult'), pg_temp.id('ubs'), 'Consultório', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('farm'), pg_temp.id('upa'), 'farmaceutico'),
  (pg_temp.id('gestor'), pg_temp.id('upa'), 'gestor'),
  (pg_temp.id('tec'), pg_temp.id('ubs'), 'tecnico_enfermagem'), (pg_temp.id('medubs'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id(u), pg_temp.id(s), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES ('upa', 'porta', 'med'), ('upa', 'porta', 'farm'), ('ubs', 'consult', 'tec'), ('ubs', 'consult', 'medubs')) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('upa'), pg_temp.id('ubs')) ON CONFLICT DO NOTHING;

-- pacientes: o cadastro fica com o último setor, como deixam a alta da porta e a consulta da UBS
INSERT INTO public.pacientes (id, unidade_id, nome, setor_id, data_nascimento)
SELECT pg_temp.id(p), pg_temp.id(u), 'Paciente ' || p, pg_temp.id(s), DATE '1970-05-05'
  FROM (VALUES ('velho', 'upa', 'porta'), ('recente', 'upa', 'porta'), ('aberto', 'upa', 'porta'), ('pubs', 'ubs', 'consult')) x(p, u, s);
INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa, chegada_em, encerrado_em, encerrado_por,
                              desfecho, desfecho_em, desfecho_por)
SELECT pg_temp.id(u), pg_temp.id(p), pg_temp.id(s), 'Queixa de teste', pg_temp.id(m),
       CASE WHEN fim IS NULL THEN 'atendimento' ELSE 'encerrado' END,
       coalesce(fim, now()) - interval '3 hours', fim, CASE WHEN fim IS NOT NULL THEN pg_temp.id(m) END,
       CASE WHEN fim IS NOT NULL THEN 'alta' END, fim, CASE WHEN fim IS NOT NULL THEN pg_temp.id(m) END
  FROM (VALUES ('velho', 'upa', 'porta', 'med', now() - interval '3 days'),
               ('recente', 'upa', 'porta', 'med', now() - interval '2 hours'),
               ('aberto', 'upa', 'porta', 'med', NULL::timestamptz),
               ('pubs', 'ubs', 'consult', 'medubs', now() - interval '3 days')) x(p, u, s, m, fim);
SELECT pg_temp.ok((SELECT count(*) = 4 FROM public.pacientes WHERE id IN (SELECT id FROM ids) AND setor_id IS NOT NULL),
  'cenário: quatro cadastros com o último setor gravado');

-- ── 1. encerrado há 3 dias: a escala do último setor não basta ──────────────
SELECT pg_temp.ok(NOT pg_temp.atua('med', 'velho'), 'médico da porta não atua no paciente encerrado há 3 dias');
SELECT pg_temp.ok(NOT pg_temp.atua('farm', 'velho'), 'farmacêutico da porta não atua no paciente encerrado há 3 dias');
SELECT pg_temp.ok(NOT pg_temp.cuida('med', 'velho'), 'nem conta como em cuidado (escrita)');
SELECT pg_temp.ok(NOT pg_temp.atua('tec', 'pubs'), 'técnico da UBS não atua no cadastro com a consulta encerrada há 3 dias');
SELECT pg_temp.ok(NOT pg_temp.atua('medubs', 'pubs'), 'médico da UBS também não (decisão P2 = A: mesma regra da rede)');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('farm');
SELECT pg_temp.falha($$SELECT public.abrir_prontuario(pg_temp.id('velho'), NULL)$$, '',
  'o farmacêutico não abre o prontuário do paciente encerrado');

-- ── 2. o técnico da UBS pede acesso (antes: "já tem acesso pela escala") ────
SELECT pg_temp.como('tec');
SELECT public.pedir_acesso_prontuario(pg_temp.id('pubs'), 'Revisar a última consulta antes do retorno');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.pedidos_acesso_prontuario
                    WHERE paciente_id = pg_temp.id('pubs') AND solicitante_id = pg_temp.id('tec')),
  'o pedido do técnico da UBS ficou gravado');

-- ── 3. o que continua igual ─────────────────────────────────────────────────
SELECT pg_temp.ok(pg_temp.cuida('med', 'aberto'), 'atendimento aberto no setor: o médico da porta cuida (escrita)');
SELECT pg_temp.ok(pg_temp.atua('farm', 'aberto'), 'atendimento aberto no setor: o farmacêutico da porta atua (dispensação)');
SELECT pg_temp.ok(pg_temp.atua('med', 'recente'), 'encerrado há 2 horas: a equipe do setor ainda lê (24 h)');
SELECT pg_temp.ok(NOT pg_temp.cuida('med', 'recente'), 'encerrado há 2 horas: a escrita do cuidado já fechou');
SELECT pg_temp.ok(pg_temp.atua('gestor', 'velho'), 'o gestor da unidade lê o encerrado');
SELECT pg_temp.ok(NOT pg_temp.atua('tec', 'velho'), 'quem é de outra unidade não atua');

-- ── 4. a porta virou observação: o atendimento da porta aberto não dá cuidado ao PS ─
-- o atendimento da porta continua aberto no PS, mas o paciente está na observação
INSERT INTO ids VALUES ('obs', '00000000-0000-4000-8000-0000000b0e13'), ('enfobs', '00000000-0000-4000-8000-0000000b0e26'),
                       ('rec', '00000000-0000-4000-8000-0000000b0e27');
INSERT INTO auth.users (id, email) SELECT id, nome || '@fixpriv.local' FROM ids WHERE nome IN ('enfobs', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('enfobs', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação Adulto', 'observacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('enfobs'), pg_temp.id('upa'), 'enfermeiro'), (pg_temp.id('rec'), pg_temp.id('upa'), 'recepcao');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('upa'), pg_temp.id(s), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES ('obs', 'enfobs'), ('porta', 'rec')) x(s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('upa') ON CONFLICT DO NOTHING;
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, episodio_id, setor_atual_id, status)
SELECT pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('aberto'), e.id, pg_temp.id('obs'), 'em_observacao'
  FROM public.episodios e WHERE e.paciente_id = pg_temp.id('aberto') AND e.encerrado_em IS NULL;
-- como na conversão real (observacao), o cadastro acompanha o paciente para a observação
UPDATE public.pacientes SET setor_id = pg_temp.id('obs') WHERE id = pg_temp.id('aberto');
SELECT pg_temp.ok(pg_temp.cuida('enfobs', 'aberto'), 'na observação: a enfermeira escalada na observação cuida');
SELECT pg_temp.ok(NOT pg_temp.cuida('rec', 'aberto'), 'na observação: a recepção do PS não cuida mais');
SELECT pg_temp.ok(NOT pg_temp.atua('rec', 'aberto'), 'na observação: a recepção do PS não atua');
SELECT pg_temp.ok(NOT pg_temp.cuida('med', 'aberto'), 'na observação: o médico do PS não cuida (o encerramento pela porta tem regra própria)');

ROLLBACK;
