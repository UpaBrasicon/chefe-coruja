-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270227000001_chave_fila.sql (chave da fila sem conexão
-- vinda do servidor; A em O1 a O5, RT em 05/11/2026).
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. cada pessoa recebe a sua chave, sempre a mesma (O1); outra pessoa recebe
--    outra; a tabela não se lê direto;
-- 2. sem segundo fator, recusado;
-- 3. trocar a chave: só o administrador da unidade da pessoa (ou o geral);
--    a chave muda e fica na auditoria.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000065a1'),
  ('upa',  '00000000-0000-4000-8000-0000000065a2'),
  ('outra','00000000-0000-4000-8000-0000000065a3'),
  ('enf',  '00000000-0000-4000-8000-0000000065b1'),
  ('tec',  '00000000-0000-4000-8000-0000000065b2'),
  ('adm',  '00000000-0000-4000-8000-0000000065b3'),
  ('adm2', '00000000-0000-4000-8000-0000000065b4');
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
CREATE TEMP TABLE v (nome text PRIMARY KEY, txt text) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@chavefila.local' FROM ids WHERE nome IN ('enf', 'tec', 'adm', 'adm2');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('enf', 'tec', 'adm', 'adm2')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede da chave da fila');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA da chave', 'upa', '9996501'),
  (pg_temp.id('outra'), pg_temp.id('org'), 'UPA vizinha da chave', 'upa', '9996502');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('enf'), pg_temp.id('upa'), 'enfermeiro'), (pg_temp.id('tec'), pg_temp.id('upa'), 'tecnico_enfermagem'),
  (pg_temp.id('adm'), pg_temp.id('upa'), 'admin'), (pg_temp.id('adm2'), pg_temp.id('outra'), 'admin');

SET LOCAL ROLE authenticated;

-- ── 1. a chave de cada pessoa ───────────────────────────────────────────────
SELECT pg_temp.como('enf');
INSERT INTO v SELECT 'enf1', public.chave_fila();
INSERT INTO v SELECT 'enf2', public.chave_fila();
SELECT pg_temp.como('tec');
INSERT INTO v SELECT 'tec', public.chave_fila();
SELECT pg_temp.ok((SELECT txt FROM v WHERE nome = 'enf1') = (SELECT txt FROM v WHERE nome = 'enf2'), 'a mesma pessoa recebe sempre a mesma chave');
SELECT pg_temp.ok(length(decode((SELECT txt FROM v WHERE nome = 'enf1'), 'base64')) = 32, 'chave de 32 bytes');
SELECT pg_temp.ok((SELECT txt FROM v WHERE nome = 'enf1') <> (SELECT txt FROM v WHERE nome = 'tec'), 'outra pessoa recebe outra chave');
SELECT pg_temp.falha('SELECT count(*) FROM private.chave_fila', 'permission denied', 'a tabela não se lê direto');

-- ── 2. segundo fator ────────────────────────────────────────────────────────
RESET ROLE;
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.falha('SELECT public.chave_fila()', 'SEGUNDO_FATOR', 'sem segundo fator, recusado');
RESET ROLE;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;

-- ── 3. trocar a chave ───────────────────────────────────────────────────────
SELECT pg_temp.como('tec');
SELECT pg_temp.falha(format('SELECT public.trocar_chave_fila(%L)', pg_temp.id('enf')), 'Acesso negado: só o administrador', 'técnico não troca');
SELECT pg_temp.como('adm2');
SELECT pg_temp.falha(format('SELECT public.trocar_chave_fila(%L)', pg_temp.id('enf')), 'Acesso negado: só o administrador', 'administrador de outra unidade não troca');
SELECT pg_temp.como('adm');
SELECT public.trocar_chave_fila(pg_temp.id('enf'));
SELECT pg_temp.como('enf');
INSERT INTO v SELECT 'enf3', public.chave_fila();
SELECT pg_temp.ok((SELECT txt FROM v WHERE nome = 'enf3') <> (SELECT txt FROM v WHERE nome = 'enf1'), 'depois da troca a chave é outra');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'chave_fila_trocada' AND entidade_id = pg_temp.id('enf')
                          AND ator_id = pg_temp.id('adm')), 'a troca fica na auditoria');

ROLLBACK;
