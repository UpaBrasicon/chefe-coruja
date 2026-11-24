-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270421000024 (perfil Gestor da secretaria, o que ficou
-- de fora; pedido do RT de 24/11/2026). Tudo em transação com ROLLBACK; o
-- cenário é criado aqui e roda também na homologação.
--
-- 1. indicadores: a secretaria vê as unidades dela lado a lado, o
--    administrador dela também; gestor de unidade e administrador de outra
--    organização não;
-- 2. aviso por e-mail: só o administrador da secretaria reserva e conclui;
--    um envio por minuto;
-- 3. papéis sem convite: gestor da unidade, secretaria e administrador; as
--    regras de gestor, administrador, rede, registro profissional e o
--    próprio papel; a secretaria não mexe em unidade de outra secretaria;
-- 4. rotina do leito (higienizar, reservar por motivo, cancelar, liberar) e
--    escala com nome nas unidades da secretaria, não nas de outra.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('orgA',  '00000000-0000-4000-8000-0000000054a1'),
  ('orgB',  '00000000-0000-4000-8000-0000000054a2'),
  ('upaA',  '00000000-0000-4000-8000-0000000054a3'),
  ('hosA',  '00000000-0000-4000-8000-0000000054a4'),
  ('cliA',  '00000000-0000-4000-8000-0000000054a5'),
  ('upaB',  '00000000-0000-4000-8000-0000000054a6'),
  ('admA',  '00000000-0000-4000-8000-0000000054a7'),
  ('admB',  '00000000-0000-4000-8000-0000000054a8'),
  ('gest',  '00000000-0000-4000-8000-0000000054a9'),
  ('secA',  '00000000-0000-4000-8000-0000000054aa'),
  ('med',   '00000000-0000-4000-8000-0000000054ab'),
  ('rec',   '00000000-0000-4000-8000-0000000054ac'),
  ('medU',  '00000000-0000-4000-8000-0000000054ad'),
  ('fora',  '00000000-0000-4000-8000-0000000054ae'),
  ('s1',    '00000000-0000-4000-8000-0000000054b1'),
  ('s2',    '00000000-0000-4000-8000-0000000054b2'),
  ('sB',    '00000000-0000-4000-8000-0000000054b3'),
  ('setH',  '00000000-0000-4000-8000-0000000054c1'),
  ('setC',  '00000000-0000-4000-8000-0000000054c2'),
  ('L1',    '00000000-0000-4000-8000-0000000054d1'),
  ('L2',    '00000000-0000-4000-8000-0000000054d2'),
  ('L3',    '00000000-0000-4000-8000-0000000054d3'),
  ('LX',    '00000000-0000-4000-8000-0000000054d4');
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
-- passa = a permissão passou (sucesso ou erro que não é a recusa esperada)
CREATE FUNCTION pg_temp.passa(p_sql text, p_recusa text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE p_recusa || '%' THEN RAISE EXCEPTION 'FALHOU (%): recusado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  % (parou depois da permissão: %)', p_ok, SQLERRM; RETURN;
  END;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.passa(text, text, text) TO authenticated;

-- ── cenário ───────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email, email_confirmed_at)
SELECT id, nome || '@completa.local', now() FROM ids WHERE nome IN ('admA', 'admB', 'gest', 'secA', 'med', 'rec', 'medU', 'fora');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('admA', 'admB', 'gest', 'secA', 'med', 'rec', 'medU', 'fora')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
UPDATE public.perfis SET conselho = 'CRM', registro_numero = '12345', registro_uf = 'GO' WHERE id IN (pg_temp.id('med'), pg_temp.id('medU'));
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('orgA'), 'Rede A completa'), (pg_temp.id('orgB'), 'Rede B completa');
INSERT INTO public.secretarias (id, organizacao_id, nome) VALUES
  (pg_temp.id('s1'), pg_temp.id('orgA'), 'Secretaria Um completa'),
  (pg_temp.id('s2'), pg_temp.id('orgA'), 'Secretaria Dois completa'),
  (pg_temp.id('sB'), pg_temp.id('orgB'), 'Secretaria da B completa');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, secretaria_id) VALUES
  (pg_temp.id('upaA'), pg_temp.id('orgA'), 'UPA A completa', 'upa', pg_temp.id('s1')),
  (pg_temp.id('hosA'), pg_temp.id('orgA'), 'Hospital A completo', 'hospital', pg_temp.id('s1')),
  (pg_temp.id('cliA'), pg_temp.id('orgA'), 'Clínica A completa', 'clinica', pg_temp.id('s2')),
  (pg_temp.id('upaB'), pg_temp.id('orgB'), 'UPA B completa', 'upa', pg_temp.id('sB'));
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('admA'), pg_temp.id('upaA'), 'admin'),
  (pg_temp.id('admB'), pg_temp.id('upaB'), 'admin'),
  (pg_temp.id('gest'), pg_temp.id('upaA'), 'gestor'),
  (pg_temp.id('medU'), pg_temp.id('upaA'), 'plantonista'),
  (pg_temp.id('med'),  pg_temp.id('hosA'), 'plantonista'),
  (pg_temp.id('rec'),  pg_temp.id('hosA'), 'recepcao'),
  (pg_temp.id('med'),  pg_temp.id('cliA'), 'plantonista');
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  (pg_temp.id('setH'), pg_temp.id('hosA'), 'Enfermaria completa', 'internacao', 1),
  (pg_temp.id('setC'), pg_temp.id('cliA'), 'Sala completa', 'observacao', 1);
INSERT INTO public.leitos (id, setor_id, identificador, tipo, status) VALUES
  (pg_temp.id('L1'), pg_temp.id('setH'), 'C01', 'clinico', 'higienizacao'),
  (pg_temp.id('L2'), pg_temp.id('setH'), 'C02', 'clinico', 'livre'),
  (pg_temp.id('L3'), pg_temp.id('setH'), 'C03', 'clinico', 'ocupado'),
  (pg_temp.id('LX'), pg_temp.id('setC'), 'X01', 'clinico', 'higienizacao');

SET LOCAL ROLE authenticated;

-- a secretaria Um tem a pessoa secA
SELECT pg_temp.como('admA');
SELECT public.admin_designar_secretaria(pg_temp.id('s1'), 'seca@completa.local');

-- ── 1. indicadores ────────────────────────────────────────────────────────
SELECT pg_temp.como('secA');
WITH i AS (SELECT public.secretaria_indicadores(2026, 12) AS j)
SELECT pg_temp.ok((SELECT jsonb_array_length(j -> 'unidades') = 2
                          AND j::text LIKE '%Hospital A completo%' AND j::text LIKE '%UPA A completa%'
                          AND j::text NOT LIKE '%Clínica A completa%' FROM i),
  'a secretaria vê as duas unidades dela, e não a de outra secretaria');
WITH i AS (SELECT public.secretaria_indicadores(2026, 12) AS j)
SELECT pg_temp.ok((SELECT (u -> 'leitos' ->> 'total')::int = 3 AND (u -> 'leitos' ->> 'higienizacao')::int = 1
                          AND (u -> 'leitos' ->> 'ocupados') IS NULL       -- 1 ocupado: suprimido
                          AND (u -> 'pessoas' ->> 'plantonista')::int = 1 AND (u -> 'pessoas_total')::int = 2
                          AND (u -> 'atendimentos')::int = 0
                     FROM i, jsonb_array_elements(j -> 'unidades') u WHERE u ->> 'nome' = 'Hospital A completo'),
  'leitos por situação, ocupação suprimida abaixo de 5 e pessoas por papel');
SELECT pg_temp.falha($$SELECT public.secretaria_indicadores(2026, 12, pg_temp.id('s2'))$$,
  'Os indicadores são de quem cuida', 'a secretaria não abre os indicadores de outra secretaria');
SELECT pg_temp.ok((SELECT jsonb_array_length(public.secretaria_indicadores(2026, 12, pg_temp.id('s1')) -> 'unidades') = 2),
  'a secretaria abre os indicadores pela própria secretaria');
SELECT pg_temp.falha($$SELECT public.secretaria_indicadores(2026, 13)$$, 'Mês inválido', 'mês inválido é recusado');

SELECT pg_temp.como('admA');
SELECT pg_temp.ok((SELECT jsonb_array_length(public.secretaria_indicadores(2026, 12, pg_temp.id('s2')) -> 'unidades') = 1),
  'o administrador abre os indicadores de qualquer secretaria da organização');
SELECT pg_temp.como('admB');
SELECT pg_temp.falha($$SELECT public.secretaria_indicadores(2026, 12, pg_temp.id('s1'))$$,
  'Os indicadores são de quem cuida', 'administrador de outra organização não abre');
SELECT pg_temp.como('gest');
SELECT pg_temp.falha($$SELECT public.secretaria_indicadores(2026, 12)$$,
  'Os indicadores são de quem cuida', 'gestor de unidade não abre os indicadores da secretaria');

-- ── 2. aviso por e-mail ───────────────────────────────────────────────────
SELECT pg_temp.como('admA');
CREATE TEMP TABLE desig ON COMMIT DROP AS
  SELECT id FROM public.secretaria_pessoas WHERE email = 'seca@completa.local';
SELECT pg_temp.ok((SELECT a ->> 'email' = 'seca@completa.local' AND a ->> 'secretaria' = 'Secretaria Um completa'
                          AND jsonb_array_length(a -> 'unidades') = 2 AND (a ->> 'pendente')::boolean = false
                     FROM (SELECT public.secretaria_aviso_reservar((SELECT id FROM desig)) AS a) x),
  'o administrador reserva o aviso e recebe o que vai no e-mail');
SELECT pg_temp.falha($$SELECT public.secretaria_aviso_reservar((SELECT id FROM desig))$$,
  'O aviso desta designação acabou de sair', 'um envio por minuto');
SELECT public.secretaria_aviso_concluir((SELECT id FROM desig), false);
SELECT pg_temp.passa($$SELECT public.secretaria_aviso_reservar((SELECT id FROM desig))$$,
  'O aviso desta designação acabou de sair', 'falhou o envio: a próxima tentativa sai na hora');
SELECT public.secretaria_aviso_concluir((SELECT id FROM desig), true);
SELECT pg_temp.ok((SELECT avisado_em IS NOT NULL FROM public.secretaria_pessoas WHERE id = (SELECT id FROM desig)),
  'o envio fica anotado');
SELECT pg_temp.como('secA');
SELECT pg_temp.falha($$SELECT public.secretaria_aviso_reservar((SELECT id FROM desig))$$,
  'Quem designa as pessoas da secretaria', 'a própria pessoa não dispara o aviso');
SELECT pg_temp.como('admB');
SELECT pg_temp.falha($$SELECT public.secretaria_aviso_concluir((SELECT id FROM desig), true)$$,
  'Quem designa as pessoas da secretaria', 'administrador de outra organização não mexe no aviso');

-- ── 3. papéis sem convite ─────────────────────────────────────────────────
SELECT pg_temp.como('secA');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.pessoas_da_unidade(pg_temp.id('hosA'))),
  'a secretaria lista as pessoas da unidade dela');
SELECT pg_temp.falha($$SELECT * FROM public.pessoas_da_unidade(pg_temp.id('cliA'))$$,
  'A lista de pessoas é do gestor', 'a secretaria não lista pessoas de unidade de outra secretaria');
SELECT pg_temp.ok((SELECT (r ->> 'mudou')::boolean FROM (SELECT public.definir_papeis_na_unidade(pg_temp.id('hosA'), pg_temp.id('med'),
                     ARRAY['plantonista', 'telemedicina']::public.papel[]) AS r) x),
  'a secretaria põe um papel a mais em quem já está na unidade');
SELECT pg_temp.ok((SELECT papeis = ARRAY['plantonista', 'telemedicina'] FROM public.pessoas_da_unidade(pg_temp.id('hosA'))
                    WHERE perfil_id = pg_temp.id('med')),
  'a lista mostra os dois papéis');
SELECT public.definir_papeis_na_unidade(pg_temp.id('hosA'), pg_temp.id('rec'), ARRAY['gestor']::public.papel[]);
SELECT pg_temp.ok((SELECT papeis = ARRAY['gestor'] AND papeis_retirados = ARRAY['recepcao']
                     FROM public.pessoas_da_unidade(pg_temp.id('hosA')) WHERE perfil_id = pg_temp.id('rec')),
  'a secretaria troca o papel (recepção vira gestor) sem convite');
SELECT pg_temp.falha($$SELECT public.definir_papeis_na_unidade(pg_temp.id('hosA'), pg_temp.id('rec'), ARRAY['gestor', 'enfermeiro']::public.papel[])$$,
  'Esta pessoa não tem registro profissional', 'papel que atende paciente pede o registro profissional');
SELECT pg_temp.falha($$SELECT public.definir_papeis_na_unidade(pg_temp.id('hosA'), pg_temp.id('med'), ARRAY['enfermeiro']::public.papel[])$$,
  'O registro da pessoa (CRM) não é o do papel', 'o registro tem de ser o do papel');
SELECT pg_temp.falha($$SELECT public.definir_papeis_na_unidade(pg_temp.id('hosA'), pg_temp.id('med'), ARRAY['admin']::public.papel[])$$,
  'O papel de administrador', 'administrador só pelo administrador da plataforma');
SELECT pg_temp.falha($$SELECT public.definir_papeis_na_unidade(pg_temp.id('hosA'), pg_temp.id('med'), ARRAY['secretaria']::public.papel[])$$,
  'Pessoas de rede', 'papel de rede só pelo administrador da plataforma');
SELECT pg_temp.falha($$SELECT public.definir_papeis_na_unidade(pg_temp.id('hosA'), pg_temp.id('fora'), ARRAY['recepcao']::public.papel[])$$,
  'Esta pessoa ainda não está na unidade', 'pessoa nova entra pelo convite');
SELECT pg_temp.falha($$SELECT public.definir_papeis_na_unidade(pg_temp.id('cliA'), pg_temp.id('med'), ARRAY['telemedicina']::public.papel[])$$,
  'Quem muda o papel', 'a secretaria não muda papel em unidade de outra secretaria');

SELECT pg_temp.como('gest');
SELECT pg_temp.falha($$SELECT public.definir_papeis_na_unidade(pg_temp.id('upaA'), pg_temp.id('medU'), ARRAY['plantonista', 'gestor']::public.papel[])$$,
  'Quem põe ou tira o gestor', 'o gestor da unidade não nomeia outro gestor');
SELECT pg_temp.falha($$SELECT public.definir_papeis_na_unidade(pg_temp.id('upaA'), pg_temp.id('gest'), ARRAY['plantonista']::public.papel[])$$,
  'Não é possível mudar o próprio papel', 'ninguém muda o próprio papel');
SELECT pg_temp.falha($$SELECT public.definir_papeis_na_unidade(pg_temp.id('upaA'), pg_temp.id('admA'), ARRAY['recepcao']::public.papel[])$$,
  'Os papéis de outro gestor', 'o gestor da unidade não mexe no administrador');
SELECT pg_temp.ok((SELECT (public.definir_papeis_na_unidade(pg_temp.id('upaA'), pg_temp.id('medU'),
                     ARRAY['plantonista', 'telemedicina']::public.papel[]) ->> 'mudou')::boolean),
  'o gestor da unidade põe papel em quem já está nela');
SELECT pg_temp.falha($$SELECT public.definir_papeis_na_unidade(pg_temp.id('hosA'), pg_temp.id('med'), ARRAY['plantonista']::public.papel[])$$,
  'Quem muda o papel', 'o gestor de uma unidade não muda papel em outra');

SELECT pg_temp.como('admA');
SELECT public.definir_papeis_na_unidade(pg_temp.id('upaA'), pg_temp.id('medU'), ARRAY[]::public.papel[]);
SELECT pg_temp.ok((SELECT cardinality(papeis) = 0 AND papeis_retirados = ARRAY['plantonista', 'telemedicina']
                     FROM public.pessoas_da_unidade(pg_temp.id('upaA')) WHERE perfil_id = pg_temp.id('medU')),
  'o administrador tira todos os papéis (a pessoa sai da unidade)');
SELECT pg_temp.ok((SELECT (public.definir_papeis_na_unidade(pg_temp.id('upaA'), pg_temp.id('medU'),
                     ARRAY['plantonista']::public.papel[]) ->> 'mudou')::boolean),
  'e devolve o papel sem convite novo');

SELECT pg_temp.como('admB');
SELECT pg_temp.falha($$SELECT * FROM public.pessoas_da_unidade(pg_temp.id('upaA'))$$,
  'A lista de pessoas é do gestor', 'administrador de outra organização não lista');

-- ── 4. rotina do leito e escala com nome ──────────────────────────────────
SELECT pg_temp.como('secA');
SELECT public.concluir_higienizacao(pg_temp.id('L1'));
SELECT pg_temp.ok((SELECT status = 'livre' FROM public.leitos WHERE id = pg_temp.id('L1')), 'a secretaria conclui a higienização');
SELECT pg_temp.falha($$SELECT public.concluir_higienizacao(pg_temp.id('LX'))$$,
  'Só a enfermagem, o gestor ou a secretaria', 'a secretaria não higieniza leito de outra secretaria');
SELECT pg_temp.falha($$SELECT public.reservar_leito(pg_temp.id('L2'), 2, gen_random_uuid(), NULL)$$,
  'A secretaria reserva leito por motivo', 'a secretaria não reserva para paciente');
SELECT public.reservar_leito(pg_temp.id('L2'), 2, NULL, 'Transferência externa chegando');
SELECT pg_temp.ok((SELECT status = 'reservado' FROM public.leitos WHERE id = pg_temp.id('L2')), 'a secretaria reserva por motivo');
SELECT pg_temp.ok((SELECT pode_cancelar_reserva AND pode_higienizar AND reserva_paciente IS NULL
                     FROM public.situacao_leitos(pg_temp.id('hosA')) WHERE leito_id = pg_temp.id('L2')),
  'a situação dos leitos dá as ações à secretaria, sem nome de paciente');
SELECT public.cancelar_reserva(pg_temp.id('L2'), 'Transferência cancelada');
SELECT pg_temp.ok((SELECT status = 'livre' FROM public.leitos WHERE id = pg_temp.id('L2')), 'a secretaria cancela a reserva');
SELECT public.liberar_leito_sem_paciente(pg_temp.id('L3'), 'Ocupado por engano no cadastro');
SELECT pg_temp.ok((SELECT status = 'higienizacao' FROM public.leitos WHERE id = pg_temp.id('L3')), 'a secretaria libera leito sem paciente');

-- a faixa pode parar no turno da unidade (cenário sem turnos); o que se
-- confere aqui é que a permissão passou
SELECT pg_temp.passa($$SELECT public.adicionar_plantao_escala(pg_temp.id('hosA'), pg_temp.id('setH'), pg_temp.id('med'),
                                                           current_date + 7, 'manha', NULL, false, 'plantonista')$$,
  'Acesso negado: apenas o gestor', 'a secretaria escala o profissional pelo nome na unidade dela');
SELECT pg_temp.falha($$SELECT public.adicionar_plantao_escala(pg_temp.id('cliA'), pg_temp.id('setC'), pg_temp.id('med'),
                                                           current_date + 7, 'manha', NULL, false, 'plantonista')$$,
  'Acesso negado: apenas o gestor', 'a secretaria não escala em unidade de outra secretaria');
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.escala_plantao WHERE unidade_id = pg_temp.id('cliA')),
  'a secretaria não lê plantão de outra secretaria');

SELECT pg_temp.como('gest');
SELECT pg_temp.falha($$SELECT public.concluir_higienizacao(pg_temp.id('L3'))$$,
  'Só a enfermagem, o gestor ou a secretaria', 'gestor de outra unidade não higieniza');

-- ── auditoria ─────────────────────────────────────────────────────────────
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) >= 5 FROM public.log_auditoria WHERE acao = 'vinculo_papeis_definidos'
                     AND unidade_id IN (pg_temp.id('hosA'), pg_temp.id('upaA'))),
  'auditoria das mudanças de papel');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.log_auditoria WHERE acao = 'secretaria_pessoa_avisada'
                     AND entidade_id = (SELECT id FROM desig)),
  'auditoria do aviso');

SELECT 'secretaria_completa ok' AS resultado;
ROLLBACK;
