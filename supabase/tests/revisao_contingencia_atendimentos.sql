-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270421000072_contingencia_atendimentos.sql.
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. o gestor vê os atendimentos do período, com a reentrada feita (e quem
--    fez) e a pendente; o atendimento de fora do período não entra;
-- 2. o médico sem plantão nem acesso ao paciente não vê nome: só a contagem
--    "fora do seu acesso";
-- 3. com pedido aprovado e vigente para um paciente, o médico vê só esse;
-- 4. conta de outra unidade é recusada; anon não executa.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000007e2001'),
  ('upa',  '00000000-0000-4000-8000-0000007e2002'),
  ('upa2', '00000000-0000-4000-8000-0000007e2003'),
  ('ps',   '00000000-0000-4000-8000-0000007e2011'),
  ('c',    '00000000-0000-4000-8000-0000007e2012'),
  ('p1',   '00000000-0000-4000-8000-0000007e2021'),
  ('p2',   '00000000-0000-4000-8000-0000007e2022'),
  ('p3',   '00000000-0000-4000-8000-0000007e2023'),
  ('e1',   '00000000-0000-4000-8000-0000007e2031'),
  ('e2',   '00000000-0000-4000-8000-0000007e2032'),
  ('e3',   '00000000-0000-4000-8000-0000007e2033'),
  ('gest', '00000000-0000-4000-8000-0000007e2041'),
  ('med',  '00000000-0000-4000-8000-0000007e2042'),
  ('fora', '00000000-0000-4000-8000-0000007e2043');
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
CREATE FUNCTION pg_temp.lista() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.contingencia_atendimentos(pg_temp.id('c')) $$;
GRANT EXECUTE ON FUNCTION pg_temp.lista() TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@revisao-cont.local' FROM ids WHERE nome IN ('gest', 'med', 'fora');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('gest', 'med', 'fora')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da contingência da revisão');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA da contingência', 'upa'),
  (pg_temp.id('upa2'), pg_temp.id('org'), 'UPA vizinha da contingência', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('ps'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('upa'), 'gestor'),
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('fora'), pg_temp.id('upa2'), 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento) VALUES
  (pg_temp.id('p1'), pg_temp.id('upa'), 'Paciente Reentrado', '1980-01-01'),
  (pg_temp.id('p2'), pg_temp.id('upa'), 'Paciente Pendente', '1981-01-01'),
  (pg_temp.id('p3'), pg_temp.id('upa'), 'Paciente Depois', '1982-01-01');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em) VALUES
  (pg_temp.id('e1'), pg_temp.id('upa'), pg_temp.id('p1'), pg_temp.id('ps'), 'atendimento', 'Febre', pg_temp.id('gest'), now() - interval '5 hours'),
  (pg_temp.id('e2'), pg_temp.id('upa'), pg_temp.id('p2'), pg_temp.id('ps'), 'atendimento', 'Tosse', pg_temp.id('gest'), now() - interval '4 hours'),
  (pg_temp.id('e3'), pg_temp.id('upa'), pg_temp.id('p3'), pg_temp.id('ps'), 'atendimento', 'Dor', pg_temp.id('gest'), now() - interval '1 hour');
INSERT INTO public.contingencias (id, unidade_id, inicio, fim, motivo, registrado_por)
VALUES (pg_temp.id('c'), pg_temp.id('upa'), now() - interval '6 hours', now() - interval '3 hours', 'Queda de internet da operadora', pg_temp.id('gest'));
INSERT INTO public.reentradas_contingencia (contingencia_id, unidade_id, episodio_id, paciente_id, descricao, registrado_por)
VALUES (pg_temp.id('c'), pg_temp.id('upa'), pg_temp.id('e1'), pg_temp.id('p1'), 'Ficha de papel C-01 anexada, com as horas reais', pg_temp.id('gest'));

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gest');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.lista()->'atendimentos') = 2 AND (pg_temp.lista()->>'fora_do_seu_acesso')::int = 0,
  'gestor vê os dois atendimentos do período; o de depois não entra');
SELECT pg_temp.ok(pg_temp.lista()->'atendimentos'->0->>'paciente_nome' = 'Paciente Pendente'
              AND pg_temp.lista()->'atendimentos'->0->>'reentrada_em' IS NULL
              AND pg_temp.lista()->'atendimentos'->1->>'reentrada_por' = 'Pessoa gest',
  'pendente primeiro; a feita diz quem marcou');
SELECT pg_temp.como('med');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.lista()->'atendimentos') = 0
              AND (pg_temp.lista()->>'fora_do_seu_acesso')::int = 2 AND (pg_temp.lista()->>'pendentes_fora')::int = 1
              AND pg_temp.lista()::text NOT ILIKE '%Paciente%',
  'médico sem acesso: só a contagem, sem nome');
RESET ROLE;
INSERT INTO public.pedidos_acesso_prontuario (organizacao_id, unidade_id, paciente_id, solicitante_id, papel, motivo, status, decidido_por, decidido_em, valido_ate)
VALUES (pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('p2'), pg_temp.id('med'), 'plantonista', 'Retorno do paciente, preciso da ficha', 'aprovado',
        pg_temp.id('gest'), now(), now() + interval '1 hour');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.lista()->'atendimentos') = 1
              AND pg_temp.lista()->'atendimentos'->0->>'paciente_nome' = 'Paciente Pendente'
              AND (pg_temp.lista()->>'fora_do_seu_acesso')::int = 1,
  'com pedido aprovado e vigente, o médico vê só esse paciente');
SELECT pg_temp.como('fora');
DO $$ BEGIN
  PERFORM pg_temp.lista();
  RAISE EXCEPTION 'FALHOU: outra unidade leu a contingência';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  gestor de outra unidade: recusado';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.contingencia_atendimentos(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
