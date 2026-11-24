-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270421000020_rede_secretaria.sql (rede a partir da
-- Secretaria, pedido do RT de 24/11/2026). Tudo em transação com ROLLBACK; o
-- cenário é criado aqui e roda também na homologação.
--
-- 1. o admin da organização cria e edita a secretaria; nome repetido, admin
--    de outra organização e gestor são recusados; ninguém grava direto;
-- 2. a árvore traz as secretarias e as unidades da organização com ramo,
--    central de regulação e pessoas; o admin de outra organização não as vê;
--    o gestor não abre a árvore;
-- 3. ligar, mover e desligar a unidade; secretaria de outra organização é
--    recusada (também pela chave composta); ramo inválido é recusado;
-- 4. não desativa secretaria com unidade ativa dentro;
-- 5. auditoria.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('orgA', '00000000-0000-4000-8000-0000000052a1'),
  ('orgB', '00000000-0000-4000-8000-0000000052a2'),
  ('upaA', '00000000-0000-4000-8000-0000000052a3'),
  ('hosA', '00000000-0000-4000-8000-0000000052a4'),
  ('upaB', '00000000-0000-4000-8000-0000000052a5'),
  ('admA', '00000000-0000-4000-8000-0000000052a6'),
  ('admB', '00000000-0000-4000-8000-0000000052a7'),
  ('gest', '00000000-0000-4000-8000-0000000052a8');
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
CREATE TEMP TABLE sec (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON sec TO authenticated;
CREATE FUNCTION pg_temp.sec(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM sec WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.sec(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@rede.local' FROM ids WHERE nome IN ('admA', 'admB', 'gest');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('admA', 'admB', 'gest')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('orgA'), 'Rede A da secretaria'), (pg_temp.id('orgB'), 'Rede B da secretaria');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('upaA'), pg_temp.id('orgA'), 'UPA A da rede', 'upa'),
  (pg_temp.id('hosA'), pg_temp.id('orgA'), 'Hospital A da rede', 'hospital'),
  (pg_temp.id('upaB'), pg_temp.id('orgB'), 'UPA B da rede', 'upa');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('admA'), pg_temp.id('upaA'), 'admin'),
  (pg_temp.id('admB'), pg_temp.id('upaB'), 'admin'),
  (pg_temp.id('gest'), pg_temp.id('upaA'), 'gestor');
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES (pg_temp.id('orgA'), pg_temp.id('hosA'), pg_temp.id('admA'))
ON CONFLICT (organizacao_id) DO UPDATE SET unidade_id = EXCLUDED.unidade_id;

SET LOCAL ROLE authenticated;

-- ── 1. secretaria ──────────────────────────────────────────────────────────
SELECT pg_temp.como('admA');
INSERT INTO sec SELECT 'mun', public.admin_salvar_secretaria(NULL, pg_temp.id('orgA'), ' Secretaria Municipal de Saúde ', 'municipal',
  'Goiânia', 'go', '12.345.678/0001-90', 'Maria Gestora', '(62) 3000-0000', 'SMS@exemplo.gov.br', NULL, true);
INSERT INTO sec SELECT 'est', public.admin_salvar_secretaria(NULL, pg_temp.id('orgA'), 'Secretaria Estadual', 'estadual');
SELECT pg_temp.ok((SELECT nome = 'Secretaria Municipal de Saúde' AND uf = 'GO' AND cnpj = '12345678000190' AND email = 'sms@exemplo.gov.br'
                     FROM public.secretarias WHERE id = pg_temp.sec('mun')), 'admin da organização cria a secretaria (dados limpos)');
SELECT pg_temp.falha($$SELECT public.admin_salvar_secretaria(NULL, pg_temp.id('orgA'), 'secretaria municipal de saúde')$$,
  'Já existe uma secretaria com este nome', 'nome repetido na organização é recusado');
SELECT pg_temp.falha($$SELECT public.admin_salvar_secretaria(NULL, pg_temp.id('orgA'), 'Outra', 'municipal', NULL, NULL, '123')$$,
  'CNPJ com 14 dígitos', 'CNPJ curto é recusado');
SELECT public.admin_salvar_secretaria(pg_temp.sec('mun'), NULL, 'Secretaria Municipal de Saúde', 'municipal',
  'Goiânia', 'GO', NULL, 'João Secretário', NULL, NULL, 'Rua 1', true);
SELECT pg_temp.ok((SELECT responsavel = 'João Secretário' AND cnpj IS NULL FROM public.secretarias WHERE id = pg_temp.sec('mun')),
  'admin edita a secretaria');
SELECT pg_temp.falha($$INSERT INTO public.secretarias (organizacao_id, nome) VALUES (pg_temp.id('orgA'), 'Direta')$$,
  'permission denied', 'ninguém insere secretaria direto');
SELECT pg_temp.falha($$UPDATE public.secretarias SET nome = 'x'$$, 'permission denied', 'ninguém altera secretaria direto');
SELECT pg_temp.falha($$UPDATE public.unidades SET secretaria_id = NULL WHERE id = pg_temp.id('upaA')$$,
  'permission denied', 'ninguém liga unidade direto');

SELECT pg_temp.como('admB');
SELECT pg_temp.falha($$SELECT public.admin_salvar_secretaria(NULL, pg_temp.id('orgA'), 'Intrusa')$$,
  'Quem cadastra a secretaria', 'admin de outra organização não cria');
SELECT pg_temp.falha($$SELECT public.admin_salvar_secretaria(pg_temp.sec('mun'), NULL, 'Tomada')$$,
  'Quem cadastra a secretaria', 'admin de outra organização não edita');
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.secretarias WHERE organizacao_id = pg_temp.id('orgA')),
  'admin de outra organização não lê as secretarias');
INSERT INTO sec SELECT 'outra', public.admin_salvar_secretaria(NULL, pg_temp.id('orgB'), 'Secretaria da rede B');
SELECT pg_temp.como('gest');
SELECT pg_temp.falha($$SELECT public.admin_salvar_secretaria(NULL, pg_temp.id('orgA'), 'Do gestor')$$,
  'Quem cadastra a secretaria', 'gestor não cria secretaria');
SELECT pg_temp.falha($$SELECT public.admin_rede_arvore()$$, 'A rede é do administrador', 'gestor não abre a árvore');
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.secretarias), 'gestor não lê secretarias');

-- ── 2 e 3. ligar, mover, desligar; árvore ──────────────────────────────────
SELECT pg_temp.como('admA');
SELECT public.admin_unidade_na_rede(pg_temp.id('upaA'), pg_temp.sec('mun'), NULL);
SELECT public.admin_unidade_na_rede(pg_temp.id('hosA'), pg_temp.sec('mun'), NULL);
SELECT pg_temp.falha($$SELECT public.admin_unidade_na_rede(pg_temp.id('upaA'), pg_temp.sec('outra'), NULL)$$,
  'Escolha uma secretaria ativa da mesma organização', 'secretaria de outra organização é recusada');
SELECT pg_temp.falha($$SELECT public.admin_unidade_na_rede(pg_temp.id('upaA'), pg_temp.sec('mun'), 'farmacia')$$,
  'Ramo inválido', 'ramo inválido é recusado');
SELECT pg_temp.falha($$SELECT public.admin_unidade_na_rede(pg_temp.id('upaB'), pg_temp.sec('mun'), NULL)$$,
  'Quem organiza a rede', 'admin não mexe em unidade de outra organização');

WITH a AS (SELECT public.admin_rede_arvore() AS j)
SELECT pg_temp.ok(
  (SELECT jsonb_array_length(j) = 1 AND j -> 0 ->> 'nome' = 'Rede A da secretaria'
          AND jsonb_array_length(j -> 0 -> 'secretarias') = 2 FROM a),
  'a árvore traz só a organização do admin, com as duas secretarias');
WITH u AS (SELECT x FROM jsonb_array_elements(public.admin_rede_arvore() -> 0 -> 'unidades') x)
SELECT pg_temp.ok(
  (SELECT x ->> 'ramo' = 'central_regulacao' AND (x ->> 'eh_central')::boolean FROM u WHERE x ->> 'nome' = 'Hospital A da rede')
  AND (SELECT x ->> 'ramo' = 'upa' AND (x -> 'pessoas' ->> 'gestor')::int = 1 AND x -> 'gestores' ->> 0 = 'Pessoa gest'
                AND x ->> 'secretaria_id' = pg_temp.sec('mun')::text FROM u WHERE x ->> 'nome' = 'UPA A da rede'),
  'cada unidade vem com o ramo (central da organização à parte), a secretaria e as pessoas');

-- mover para a estadual e mudar o ramo; depois desligar
SELECT public.admin_unidade_na_rede(pg_temp.id('upaA'), pg_temp.sec('est'), 'ambulatorio');
SELECT pg_temp.ok((SELECT secretaria_id = pg_temp.sec('est') AND ramo_rede = 'ambulatorio' AND tipo = 'upa'
                     FROM public.unidades WHERE id = pg_temp.id('upaA')), 'admin move a unidade e muda o ramo sem mudar o tipo');
SELECT public.admin_unidade_na_rede(pg_temp.id('upaA'), NULL, NULL);
SELECT pg_temp.ok((SELECT secretaria_id IS NULL AND ramo_rede IS NULL FROM public.unidades WHERE id = pg_temp.id('upaA')),
  'admin desliga a unidade da secretaria');

SELECT pg_temp.como('admB');
SELECT pg_temp.ok((SELECT NOT (public.admin_rede_arvore()::text LIKE '%Rede A da secretaria%')),
  'admin de outra organização não vê a árvore da organização A');

-- ── 4. desativar ───────────────────────────────────────────────────────────
SELECT pg_temp.como('admA');
SELECT pg_temp.falha($$SELECT public.admin_salvar_secretaria(pg_temp.sec('mun'), NULL, 'Secretaria Municipal de Saúde', 'municipal',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, false)$$, 'Mova as unidades ativas', 'não desativa secretaria com unidade ativa');
SELECT public.admin_salvar_secretaria(pg_temp.sec('est'), NULL, 'Secretaria Estadual', 'estadual',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, false);
SELECT pg_temp.falha($$SELECT public.admin_unidade_na_rede(pg_temp.id('upaA'), pg_temp.sec('est'), NULL)$$,
  'Escolha uma secretaria ativa', 'não liga unidade a secretaria inativa');

-- ── chave composta: mesmo pelo dono do banco ───────────────────────────────
RESET ROLE;
SELECT pg_temp.falha($$UPDATE public.unidades SET secretaria_id = pg_temp.sec('outra') WHERE id = pg_temp.id('upaA')$$,
  'insert or update on table "unidades" violates foreign key constraint', 'a chave composta barra secretaria de outra organização');

-- ── 5. auditoria ───────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.log_auditoria WHERE entidade_id = pg_temp.sec('mun') AND acao = 'secretaria_criada'),
  'auditoria da criação da secretaria');
SELECT pg_temp.ok((SELECT count(*) >= 1 FROM public.log_auditoria WHERE entidade_id = pg_temp.sec('mun') AND acao = 'secretaria_editada'),
  'auditoria da edição da secretaria');
SELECT pg_temp.ok((SELECT count(*) = 3 FROM public.log_auditoria WHERE entidade_id = pg_temp.id('upaA') AND acao = 'unidade_na_rede'),
  'auditoria de ligar, mover e desligar a unidade');

SELECT 'rede_secretaria ok' AS resultado;
ROLLBACK;
