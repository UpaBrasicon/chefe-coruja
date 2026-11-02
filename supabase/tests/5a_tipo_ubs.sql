-- ════════════════════════════════════════════════════════════════════════════
-- Testes das migrations 20270210000001_tipo_unidade_ubs.sql e
-- 20270210000002_unidade_cadastro.sql (5A, tarefa 1). Tudo em transação com
-- ROLLBACK. O cenário é criado aqui, sem depender do seed; roda também na
-- homologação.
--
-- 1. o admin da organização cria uma UBS; nome repetido é recusado;
-- 2. o admin de outra organização e o gestor não criam;
-- 3. edição: sem mudança não grava auditoria; tipo não muda com leito ocupado;
-- 4. o gestor não muda tipo, nome, ativo nem organização direto; o que a
--    Configuração grava continua passando;
-- 5. os eventos unidade_criada e unidade_editada ficam na auditoria.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('orgA', '00000000-0000-4000-8000-0000000051a1'),
  ('orgB', '00000000-0000-4000-8000-0000000051a2'),
  ('upaA', '00000000-0000-4000-8000-0000000051a3'),
  ('upaB', '00000000-0000-4000-8000-0000000051a4'),
  ('admA', '00000000-0000-4000-8000-0000000051a5'),
  ('admB', '00000000-0000-4000-8000-0000000051a6'),
  ('gest', '00000000-0000-4000-8000-0000000051a7'),
  ('setr', '00000000-0000-4000-8000-0000000051a8');
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
CREATE TEMP TABLE criada (id uuid) ON COMMIT DROP;
GRANT ALL ON criada TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a.local' FROM ids WHERE nome IN ('admA', 'admB', 'gest');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('admA', 'admB', 'gest')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('orgA'), 'Rede A do 5A'), (pg_temp.id('orgB'), 'Rede B do 5A');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('upaA'), pg_temp.id('orgA'), 'UPA A do 5A', 'upa'),
  (pg_temp.id('upaB'), pg_temp.id('orgB'), 'UPA B do 5A', 'upa');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('admA'), pg_temp.id('upaA'), 'admin'),
  (pg_temp.id('admB'), pg_temp.id('upaB'), 'admin'),
  (pg_temp.id('gest'), pg_temp.id('upaA'), 'gestor');

SET LOCAL ROLE authenticated;

-- ── 1 e 2. criar ────────────────────────────────────────────────────────────
SELECT pg_temp.como('admA');
INSERT INTO criada SELECT public.admin_criar_unidade(pg_temp.id('orgA'), ' UBS Vila Nova ', 'ubs', NULL, 'Goiânia', 'go');
SELECT pg_temp.ok((SELECT tipo = 'ubs' AND nome = 'UBS Vila Nova' AND uf = 'GO' AND ativo
                     FROM public.unidades WHERE id = (SELECT id FROM criada)), 'admin da organização cria a UBS');
SELECT pg_temp.falha($$SELECT public.admin_criar_unidade(pg_temp.id('orgA'), 'ubs vila nova', 'ubs')$$,
  'Já existe uma unidade com este nome', 'nome repetido na organização é recusado');
SELECT pg_temp.como('admB');
SELECT pg_temp.falha($$SELECT public.admin_criar_unidade(pg_temp.id('orgA'), 'UBS Intrusa', 'ubs')$$,
  'Quem cadastra unidade', 'admin de outra organização não cria');
SELECT pg_temp.como('gest');
SELECT pg_temp.falha($$SELECT public.admin_criar_unidade(pg_temp.id('orgA'), 'UBS do Gestor', 'ubs')$$,
  'Quem cadastra unidade', 'gestor não cria unidade');
SELECT pg_temp.falha($$INSERT INTO public.unidades (organizacao_id, nome, tipo) VALUES (pg_temp.id('orgA'), 'Direta', 'ubs')$$,
  'permission denied', 'ninguém insere unidade direto');

-- ── 3. editar ───────────────────────────────────────────────────────────────
SELECT pg_temp.como('admA');
SELECT public.admin_editar_unidade((SELECT id FROM criada), 'UBS Vila Nova', 'ubs', true, 'Goiânia', 'GO');
RESET ROLE;
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id = (SELECT id FROM criada) AND acao = 'unidade_editada'),
  'edição sem mudança não grava auditoria');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setr'), pg_temp.id('upaA'), 'Observação A', 'observacao');
INSERT INTO public.leitos (setor_id, identificador, status) VALUES (pg_temp.id('setr'), 'A1', 'ocupado');
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha($$SELECT public.admin_editar_unidade(pg_temp.id('upaA'), 'UPA A do 5A', 'ubs', true)$$,
  'O tipo só muda sem atendimento aberto', 'tipo não muda com leito ocupado');
SELECT public.admin_editar_unidade((SELECT id FROM criada), 'UBS Vila Nova II', 'ubs', true, 'Goiânia', 'GO');
SELECT pg_temp.ok((SELECT nome = 'UBS Vila Nova II' FROM public.unidades WHERE id = (SELECT id FROM criada)), 'admin renomeia a UBS');
SELECT pg_temp.como('gest');
SELECT pg_temp.falha($$SELECT public.admin_editar_unidade(pg_temp.id('upaA'), 'UPA A do 5A', 'hospital', true)$$,
  'Quem altera a unidade', 'gestor não usa a edição do admin');

-- ── 4. gestor sem escrita direta da identificação ───────────────────────────
SELECT pg_temp.falha($$UPDATE public.unidades SET tipo = 'hospital' WHERE id = pg_temp.id('upaA')$$, 'permission denied', 'gestor não muda o tipo direto');
SELECT pg_temp.falha($$UPDATE public.unidades SET organizacao_id = pg_temp.id('orgB') WHERE id = pg_temp.id('upaA')$$, 'permission denied', 'gestor não muda a organização direto');
SELECT pg_temp.falha($$UPDATE public.unidades SET nome = 'Outro', ativo = false WHERE id = pg_temp.id('upaA')$$, 'permission denied', 'gestor não muda nome nem ativo direto');
UPDATE public.unidades SET raio_metros = 321, canal_comunicacao = 'chat', whatsapp_numero = NULL, latitude = -16.7, longitude = -49.3
 WHERE id = pg_temp.id('upaA');
RESET ROLE;
SELECT pg_temp.ok((SELECT raio_metros = 321 FROM public.unidades WHERE id = pg_temp.id('upaA')), 'Configuração do gestor continua gravando');

-- ── 5. auditoria ────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.log_auditoria WHERE entidade_id = (SELECT id FROM criada) AND acao = 'unidade_criada'
                     AND payload ->> 'tipo' = 'ubs'), 'auditoria da criação');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.log_auditoria WHERE entidade_id = (SELECT id FROM criada) AND acao = 'unidade_editada'
                     AND payload -> 'campos_alterados' IS NOT NULL), 'auditoria da edição, com os campos alterados');

SELECT '5a_tipo_ubs ok' AS resultado;
ROLLBACK;
