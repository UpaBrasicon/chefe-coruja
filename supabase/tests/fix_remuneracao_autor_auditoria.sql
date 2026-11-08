-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270308000004_remuneracao_autor_auditoria.sql (achado
-- C P2-C1 do teste da rede; A em M1 e M2). Tudo em transação com ROLLBACK. O
-- cenário é criado aqui.
--
-- 1. o gestor inclui pela tabela (como a tela) mandando criado_por nulo: o
--    servidor grava o login; a inclusão vai à auditoria com o valor;
-- 2. o gestor muda o valor e depois desativa: atualizado_por = login,
--    criado_por não muda, auditoria de alteração (com o valor anterior) e de
--    desativação;
-- 3. criado_por forjado pela tela é ignorado;
-- 4. o plantonista continua sem gravar (RLS).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000a9d01'),
  ('upa',   '00000000-0000-4000-8000-0000000a9d02'),
  ('porta', '00000000-0000-4000-8000-0000000a9d11'),
  ('gest',  '00000000-0000-4000-8000-0000000a9d21'),
  ('gest2', '00000000-0000-4000-8000-0000000a9d22'),
  ('med',   '00000000-0000-4000-8000-0000000a9d23'),
  ('r1',    '00000000-0000-4000-8000-0000000a9d31'),
  ('r2',    '00000000-0000-4000-8000-0000000a9d32');
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
CREATE FUNCTION pg_temp.linha(p text) RETURNS public.remuneracoes_plantao LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.remuneracoes_plantao WHERE id = pg_temp.id(p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.linha(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@remun.local' FROM ids WHERE nome IN ('gest', 'gest2', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('gest', 'gest2', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da remuneração');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA da remuneração', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('upa'), 'gestor'), (pg_temp.id('gest2'), pg_temp.id('upa'), 'gestor'),
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista');

SET LOCAL ROLE authenticated;

-- ── 1. inclusão (como a tela: criado_por nulo) ──────────────────────────────
SELECT pg_temp.como('gest');
INSERT INTO public.remuneracoes_plantao (id, unidade_id, setor_id, turno, valor, criado_por)
VALUES (pg_temp.id('r1'), pg_temp.id('upa'), pg_temp.id('porta'), 'manha', 1200, NULL);
RESET ROLE;
SELECT pg_temp.ok((pg_temp.linha('r1')).criado_por = pg_temp.id('gest'), 'M1: o servidor grava o autor (login), mesmo com a tela mandando nulo');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade = 'remuneracoes_plantao' AND entidade_id = pg_temp.id('r1')
                            AND acao = 'remuneracao_incluida' AND ator_id = pg_temp.id('gest')
                            AND payload ->> 'quantidade' = '1200' AND payload ->> 'tipo' = 'manha'),
  'M2: a inclusão vai à auditoria, com o turno e o valor');
SET LOCAL ROLE authenticated;

-- ── 2. mudança e desativação por outro gestor ───────────────────────────────
SELECT pg_temp.como('gest2');
UPDATE public.remuneracoes_plantao SET valor = 1300 WHERE id = pg_temp.id('r1');
UPDATE public.remuneracoes_plantao SET ativo = false WHERE id = pg_temp.id('r1');
RESET ROLE;
SELECT pg_temp.ok((pg_temp.linha('r1')).criado_por = pg_temp.id('gest') AND (pg_temp.linha('r1')).atualizado_por = pg_temp.id('gest2'),
  'M1: quem mudou e desativou fica em atualizado_por; o autor da inclusão não muda');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id = pg_temp.id('r1') AND acao = 'remuneracao_alterada'
                            AND ator_id = pg_temp.id('gest2') AND payload ->> 'anterior' = '1200' AND payload ->> 'quantidade' = '1300')
                  AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id = pg_temp.id('r1') AND acao = 'remuneracao_desativada'
                            AND ator_id = pg_temp.id('gest2')),
  'M2: mudança (com o valor anterior) e desativação vão à auditoria');
SET LOCAL ROLE authenticated;

-- ── 3. autor forjado pela tela ──────────────────────────────────────────────
SELECT pg_temp.como('gest');
INSERT INTO public.remuneracoes_plantao (id, unidade_id, turno, valor, criado_por)
VALUES (pg_temp.id('r2'), pg_temp.id('upa'), 'noite', 1500, pg_temp.id('med'));
RESET ROLE;
SELECT pg_temp.ok((pg_temp.linha('r2')).criado_por = pg_temp.id('gest'), 'M1: o criado_por mandado pela tela é ignorado');
SET LOCAL ROLE authenticated;

-- ── 4. o plantonista não grava ──────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.falha(format($q$INSERT INTO public.remuneracoes_plantao (unidade_id, turno, valor) VALUES (%L, 'tarde', 900)$q$, pg_temp.id('upa')),
  'new row violates row-level security', 'o plantonista continua sem gravar a remuneração');
ROLLBACK;
