-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270421000074_ia_teto_mensal.sql.
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. sem teto definido, a leitura volta vazia (não há valor padrão);
-- 2. o administrador geral define, altera e tira o teto; cada mudança vai à
--    auditoria; valor zero ou negativo é recusado;
-- 3. quem não é administrador geral não lê nem define (42501);
-- 4. a tabela não tem grant para authenticated; anon não executa.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
DELETE FROM private.ia_teto_mensal;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('adm', '00000000-0000-4000-8000-0000007e3001'),
  ('ges', '00000000-0000-4000-8000-0000007e3002'),
  ('org', '00000000-0000-4000-8000-0000007e3003'),
  ('upa', '00000000-0000-4000-8000-0000007e3004');
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
CREATE FUNCTION pg_temp.recusa(p_sql text, p_estado text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> p_estado THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado % %', p_ok, SQLSTATE, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % (passou sem erro)', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.recusa(text, text, text) TO authenticated;
-- lido como postgres
CREATE FUNCTION pg_temp.auditorias() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.log_auditoria WHERE acao = 'definir_ia_teto_mensal' AND ator_id = pg_temp.id('adm') $$;
GRANT EXECUTE ON FUNCTION pg_temp.auditorias() TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@revisao-teto.local' FROM ids WHERE nome IN ('adm', 'ges');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('adm', 'ges')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.super_admins (perfil_id) VALUES (pg_temp.id('adm')) ON CONFLICT DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do teto da IA');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do teto', 'upa');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('ges'), pg_temp.id('upa'), 'gestor');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('adm');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ia_teto_mensal()), 'sem teto definido, sem valor padrão');
SELECT public.definir_ia_teto_mensal(50);
SELECT pg_temp.ok((SELECT usd FROM public.ia_teto_mensal()) = 50.00 AND (SELECT definido_por FROM public.ia_teto_mensal()) = 'Pessoa adm',
  'o administrador geral define o teto, com o nome de quem definiu');
SELECT public.definir_ia_teto_mensal(75.456);
SELECT pg_temp.ok((SELECT usd FROM public.ia_teto_mensal()) = 75.46 AND (SELECT count(*) FROM public.ia_teto_mensal()) = 1,
  'alterar troca o valor (duas casas), sem duplicar');
SELECT pg_temp.recusa('SELECT public.definir_ia_teto_mensal(0)', 'P0001', 'teto zero recusado');
SELECT public.definir_ia_teto_mensal(NULL);
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ia_teto_mensal()), 'nulo tira o teto');
SELECT pg_temp.ok(pg_temp.auditorias() = 3, 'cada mudança vai à auditoria');
SELECT pg_temp.como('ges');
SELECT pg_temp.recusa('SELECT * FROM public.ia_teto_mensal()', '42501', 'gestor não lê o teto');
SELECT pg_temp.recusa('SELECT public.definir_ia_teto_mensal(10)', '42501', 'gestor não define o teto');
RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('authenticated', 'private.ia_teto_mensal', 'SELECT')
     OR has_function_privilege('anon', 'public.definir_ia_teto_mensal(numeric)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ia_teto_mensal()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: exposto';
  END IF;
  RAISE NOTICE 'OK  só por RPC; fora do anon';
END $$;
ROLLBACK;
