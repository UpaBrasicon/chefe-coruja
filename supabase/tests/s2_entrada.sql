-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S2: entrada na conta (migrations 20270414000057 expand e
-- 20270414000058 contract).
-- 1. Convites novos com 8 caracteres; os de 5 continuam valendo.
-- 2. aceitar_convite_com_limite: código errado devolve 'nao_confere' e conta;
--    depois de 10 erros na hora, 'muitas_tentativas'; código certo aplica.
--    A aceitar_convite antiga não existe mais.
-- 3. concluir_adesao recusa e-mail não confirmado; adesoes_da_organizacao mostra.
-- 4. Contrato aceita o formato novo, e novo_codigo_contrato() gera nele.
-- Tudo em transação com ROLLBACK, sem depender do seed.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- isola o limite de tentativas de outros testes (desfeito no ROLLBACK)
DELETE FROM private.tentativas_primeiro_acesso;
DELETE FROM private.tentativas_convite_conta;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',    '00000000-0000-4000-8000-0000000052a1'),
  ('uni',    '00000000-0000-4000-8000-0000000052a2'),
  ('ges',    '00000000-0000-4000-8000-0000000052b1'),
  ('nova',   '00000000-0000-4000-8000-0000000052b2'),
  ('adm',    '00000000-0000-4000-8000-0000000052b3'),
  ('aderiu', '00000000-0000-4000-8000-0000000052b4'),
  ('contra', '00000000-0000-4000-8000-0000000052c1'),
  ('adesao', '00000000-0000-4000-8000-0000000052c2');
GRANT ALL ON ids TO authenticated;
CREATE TEMP TABLE codigos (nome text PRIMARY KEY, codigo text) ON COMMIT DROP;
GRANT ALL ON codigos TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.cod(p text) RETURNS text LANGUAGE sql AS $$ SELECT codigo FROM codigos WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.cod(text) TO authenticated;
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
CREATE FUNCTION pg_temp.tem_vinculo(p_perfil text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = (SELECT id FROM ids WHERE nome = p_perfil) AND ativo) $$;
GRANT EXECUTE ON FUNCTION pg_temp.tem_vinculo(text) TO authenticated;
-- CPF válido a partir de 9 dígitos (sem colidir com cadastro de verdade)
CREATE FUNCTION pg_temp.cpf(base text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s int := 0; d1 int; d2 int; i int;
BEGIN
  FOR i IN 1..9 LOOP s := s + substr(base, i, 1)::int * (11 - i); END LOOP;
  d1 := (s * 10) % 11; IF d1 = 10 THEN d1 := 0; END IF;
  s := 0;
  FOR i IN 1..9 LOOP s := s + substr(base, i, 1)::int * (12 - i); END LOOP;
  s := s + d1 * 2;
  d2 := (s * 10) % 11; IF d2 = 10 THEN d2 := 0; END IF;
  RETURN base || d1 || d2;
END $$;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@s2.local' FROM ids WHERE nome IN ('ges', 'nova', 'adm', 'aderiu');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome || ' Teste' FROM ids WHERE nome IN ('ges', 'nova', 'adm', 'aderiu')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
UPDATE public.perfis SET cpf = pg_temp.cpf('918273645'), data_nascimento = date '1990-05-10' WHERE id = pg_temp.id('nova');
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do S2');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('uni'), pg_temp.id('org'), 'UPA do S2', 'upa');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('ges'), pg_temp.id('uni'), 'gestor'),
  (pg_temp.id('adm'), pg_temp.id('uni'), 'admin');
INSERT INTO public.contratos_rede (id, codigo, organizacao_id, papel_padrao)
VALUES (pg_temp.id('contra'), 'CT-2099-AB12CD', pg_temp.id('org'), 'gestor');
INSERT INTO public.adesoes_contrato (id, contrato_id, perfil_id, papel)
VALUES (pg_temp.id('adesao'), pg_temp.id('contra'), pg_temp.id('aderiu'), 'gestor');
-- convite antigo, de 5 caracteres, ainda válido
INSERT INTO public.convites (codigo, unidade_id, papel, criado_por, expira_em)
VALUES ('CC-2B3C4', pg_temp.id('uni'), 'recepcao', pg_temp.id('ges'), now() + interval '3 days');

-- ── 4. Contrato ───────────────────────────────────────────────────────────────
SELECT pg_temp.ok(private.novo_codigo_contrato() ~ '^CT-[0-9]{4}-[A-Z0-9]{6}$', 'código novo de contrato no formato CT-ano-XXXXXX');

SET LOCAL ROLE authenticated;

-- ── 1. Convite de 8 caracteres ───────────────────────────────────────────────
SELECT pg_temp.como('ges');
INSERT INTO codigos SELECT 'novo', g.codigo FROM public.gerar_convite(pg_temp.id('uni'), 'recepcao') g;
SELECT pg_temp.ok(pg_temp.cod('novo') ~ '^CC-[A-Z0-9]{8}$', 'convite novo sai com 8 caracteres');
SELECT pg_temp.ok((SELECT situacao FROM public.conferir_convite(pg_temp.cod('novo'))) = 'valido', 'conferir_convite aceita o código de 8');
SELECT pg_temp.ok((SELECT situacao FROM public.conferir_convite('CC-2B3C4')) = 'valido', 'conferir_convite aceita o código de 5 que já existia');

-- ── 2. Aceitar com limite ────────────────────────────────────────────────────
SELECT pg_temp.ok(to_regprocedure('public.aceitar_convite(text,text,text,text,date,text,text,text)') IS NULL,
  'a aceitar_convite antiga, sem limite, não existe mais');
SELECT pg_temp.como('nova');
SELECT pg_temp.ok(public.aceitar_convite_com_limite('CC-ZZZZZZZZ', private.termo_uso_versao()) = 'nao_confere',
  'código errado devolve nao_confere, sem erro');
DO $$
DECLARE i int; r text;
BEGIN
  FOR i IN 1..9 LOOP r := public.aceitar_convite_com_limite('CC-ZZZZZZZZ', private.termo_uso_versao()); END LOOP;
  IF r <> 'nao_confere' THEN RAISE EXCEPTION 'FALHOU: bloqueou cedo demais (%)', r; END IF;
END $$;
SELECT pg_temp.ok(public.aceitar_convite_com_limite(pg_temp.cod('novo'), private.termo_uso_versao()) = 'muitas_tentativas',
  'depois de 10 erros, nem o código certo passa (muitas_tentativas)');

-- sem o bloqueio, o código certo aplica o convite
RESET ROLE;
DELETE FROM private.tentativas_primeiro_acesso;
DELETE FROM private.tentativas_convite_conta;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('nova');
SELECT pg_temp.ok(public.aceitar_convite_com_limite(pg_temp.cod('novo'), private.termo_uso_versao()) = 'ok',
  'código certo devolve ok');
SELECT pg_temp.ok(pg_temp.tem_vinculo('nova'), 'convite aceito cria o vínculo');

-- ── 3. Adesão com e-mail confirmado ──────────────────────────────────────────
SELECT pg_temp.como('adm');
SELECT pg_temp.ok((SELECT email_confirmado FROM public.adesoes_da_organizacao() WHERE id = pg_temp.id('adesao')) IS FALSE,
  'a lista mostra o e-mail não confirmado');
SELECT pg_temp.falha(format('SELECT public.concluir_adesao(%L, %L)', pg_temp.id('adesao'), pg_temp.id('uni')),
  'A pessoa ainda não confirmou o e-mail', 'adesão de e-mail não confirmado é recusada');
RESET ROLE;
UPDATE auth.users SET email_confirmed_at = now() WHERE id = pg_temp.id('aderiu');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('adm');
SELECT pg_temp.ok((SELECT email_confirmado FROM public.adesoes_da_organizacao() WHERE id = pg_temp.id('adesao')),
  'a lista mostra o e-mail confirmado');
SELECT public.concluir_adesao(pg_temp.id('adesao'), pg_temp.id('uni'));
SELECT pg_temp.ok(pg_temp.tem_vinculo('aderiu'), 'adesão de e-mail confirmado é concluída');

RESET ROLE;
ROLLBACK;
