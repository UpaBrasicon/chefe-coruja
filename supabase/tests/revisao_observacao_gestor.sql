-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270421000070_observacao_gestor_varios_papeis.sql.
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. o gestor de papel único vê o paciente em observação;
-- 2. a conta com admin, gestor e plantonista na unidade (como a do RT) também
--    vê, sem estar na escala;
-- 3. o médico fora da escala da observação não vê;
-- 4. conta de outra unidade é recusada.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000007e0001'),
  ('upa',  '00000000-0000-4000-8000-0000007e0002'),
  ('upa2', '00000000-0000-4000-8000-0000007e0003'),
  ('obs',  '00000000-0000-4000-8000-0000007e0011'),
  ('pac',  '00000000-0000-4000-8000-0000007e0021'),
  ('gest', '00000000-0000-4000-8000-0000007e0031'),
  ('rt',   '00000000-0000-4000-8000-0000007e0032'),
  ('med',  '00000000-0000-4000-8000-0000007e0033'),
  ('fora', '00000000-0000-4000-8000-0000007e0034');
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
CREATE FUNCTION pg_temp.vistos() RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.painel_observacao(pg_temp.id('upa')) x WHERE x.paciente_id = pg_temp.id('pac') $$;
GRANT EXECUTE ON FUNCTION pg_temp.vistos() TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@revisao-obs.local' FROM ids WHERE nome IN ('gest', 'rt', 'med', 'fora');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('gest', 'rt', 'med', 'fora')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da revisão da observação');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA da revisão', 'upa'),
  (pg_temp.id('upa2'), pg_temp.id('org'), 'UPA vizinha da revisão', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação Adulto', 'observacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('upa'), 'gestor'),
  (pg_temp.id('rt'), pg_temp.id('upa'), 'admin'), (pg_temp.id('rt'), pg_temp.id('upa'), 'gestor'),
  (pg_temp.id('rt'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'),
  (pg_temp.id('fora'), pg_temp.id('upa2'), 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento)
VALUES (pg_temp.id('pac'), pg_temp.id('upa'), 'Paciente da Revisão', '1970-03-03');
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, tipo_internacao, origem_admissao, status, setor_atual_id, data_entrada_setor)
VALUES (pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac'), 'observacao', 'emergencia', 'em_observacao', pg_temp.id('obs'), now());

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gest');
SELECT pg_temp.ok(pg_temp.vistos() = 1, 'gestor de papel único vê o paciente em observação');
SELECT pg_temp.como('rt');
SELECT pg_temp.ok(private.papel_na_unidade(pg_temp.id('upa')) = 'admin', 'a conta do RT tem admin como papel mais forte');
SELECT pg_temp.ok(pg_temp.vistos() = 1, 'conta com admin, gestor e plantonista vê o paciente sem estar na escala');
SELECT pg_temp.como('med');
SELECT pg_temp.ok(pg_temp.vistos() = 0, 'médico fora da escala da observação não vê');
SELECT pg_temp.como('fora');
DO $$ BEGIN
  PERFORM pg_temp.vistos();
  RAISE EXCEPTION 'FALHOU: outra unidade leu a observação';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  gestor de outra unidade: recusado';
END $$;
RESET ROLE;
ROLLBACK;
