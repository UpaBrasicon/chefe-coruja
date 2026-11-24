-- ════════════════════════════════════════════════════════════════════════════
-- Testes das migrations 20270421000022 e 20270421000023 (perfil Secretaria,
-- pedido do RT de 24/11/2026). Tudo em transação com ROLLBACK; o cenário é
-- criado aqui e roda também na homologação.
--
-- 1. o administrador designa pessoas para a secretaria (com conta = ativa;
--    sem conta = pendente); gestor, a própria secretaria e o administrador de
--    outra organização não designam;
-- 2. a secretaria edita a unidade dela (configuração, setor, leito, CNES,
--    escala do mês, convites) e não edita a de outra secretaria;
-- 3. o gestor de unidade não edita a secretaria nem abre a rede dela;
-- 4. a designação pendente vale quando a pessoa entra com o e-mail confirmado;
-- 5. retirada a designação, o acesso some;
-- 6. 'gestor_secretaria' não vira vínculo; árvore e auditoria.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('orgA', '00000000-0000-4000-8000-0000000053a1'),
  ('orgB', '00000000-0000-4000-8000-0000000053a2'),
  ('upaA', '00000000-0000-4000-8000-0000000053a3'),
  ('hosA', '00000000-0000-4000-8000-0000000053a4'),
  ('ubsA', '00000000-0000-4000-8000-0000000053a5'),
  ('upaB', '00000000-0000-4000-8000-0000000053a6'),
  ('admA', '00000000-0000-4000-8000-0000000053a7'),
  ('admB', '00000000-0000-4000-8000-0000000053a8'),
  ('gest', '00000000-0000-4000-8000-0000000053a9'),
  ('secA', '00000000-0000-4000-8000-0000000053aa'),
  ('novo', '00000000-0000-4000-8000-0000000053ab'),
  ('s1',   '00000000-0000-4000-8000-0000000053ac'),
  ('s2',   '00000000-0000-4000-8000-0000000053ad'),
  ('sB',   '00000000-0000-4000-8000-0000000053ae'),
  ('setOutra', '00000000-0000-4000-8000-0000000053af');
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
-- quantas linhas o comando mudou (a RLS esconde a linha em vez de dar erro)
CREATE FUNCTION pg_temp.linhas(p_sql text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.linhas(text) TO authenticated;
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

INSERT INTO auth.users (id, email, email_confirmed_at)
SELECT id, nome || '@secretaria.local', now() FROM ids WHERE nome IN ('admA', 'admB', 'gest', 'secA');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('admA', 'admB', 'gest', 'secA')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('orgA'), 'Rede A do perfil'), (pg_temp.id('orgB'), 'Rede B do perfil');
INSERT INTO public.secretarias (id, organizacao_id, nome) VALUES
  (pg_temp.id('s1'), pg_temp.id('orgA'), 'Secretaria Um'),
  (pg_temp.id('s2'), pg_temp.id('orgA'), 'Secretaria Dois'),
  (pg_temp.id('sB'), pg_temp.id('orgB'), 'Secretaria da B');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, secretaria_id) VALUES
  (pg_temp.id('upaA'), pg_temp.id('orgA'), 'UPA A do perfil', 'upa', pg_temp.id('s1')),
  (pg_temp.id('hosA'), pg_temp.id('orgA'), 'Hospital A do perfil', 'hospital', pg_temp.id('s1')),
  (pg_temp.id('ubsA'), pg_temp.id('orgA'), 'Clínica A do perfil', 'clinica', pg_temp.id('s2')),
  (pg_temp.id('upaB'), pg_temp.id('orgB'), 'UPA B do perfil', 'upa', pg_temp.id('sB'));
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('admA'), pg_temp.id('upaA'), 'admin'),
  (pg_temp.id('admB'), pg_temp.id('upaB'), 'admin'),
  (pg_temp.id('gest'), pg_temp.id('upaA'), 'gestor');
-- um setor da UBS da outra secretaria, para o passo negativo do leito
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES (pg_temp.id('setOutra'), pg_temp.id('ubsA'), 'Sala da UBS', 'observacao', 1);

SET LOCAL ROLE authenticated;

-- ── 1. designar ────────────────────────────────────────────────────────────
SELECT pg_temp.como('admA');
SELECT pg_temp.ok((public.admin_designar_secretaria(pg_temp.id('s1'), ' SECA@Secretaria.local ') ->> 'pendente')::boolean = false,
  'admin designa quem já tem conta: vale na hora');
SELECT pg_temp.ok((public.admin_designar_secretaria(pg_temp.id('s1'), 'novo@secretaria.local') ->> 'pendente')::boolean,
  'admin designa e-mail sem conta: fica pendente');
SELECT pg_temp.falha($$SELECT public.admin_designar_secretaria(pg_temp.id('s1'), 'sem-arroba')$$, 'E-mail inválido', 'e-mail inválido é recusado');
SELECT pg_temp.ok((SELECT jsonb_array_length(public.admin_secretaria_pessoas(pg_temp.id('s1'))) = 2), 'admin lista as pessoas da secretaria');
SELECT pg_temp.falha($$INSERT INTO public.secretaria_pessoas (secretaria_id, email, designado_por) VALUES (pg_temp.id('s1'), 'x@y.z', pg_temp.id('admA'))$$,
  'permission denied', 'ninguém grava pessoa da secretaria direto');
WITH a AS (SELECT public.admin_rede_arvore() AS j)
SELECT pg_temp.ok((SELECT s -> 'gestao' @> '[{"nome": "Pessoa secA", "pendente": false}, {"nome": "novo@secretaria.local", "pendente": true}]'::jsonb
                     FROM a, jsonb_array_elements(j -> 0 -> 'secretarias') s WHERE s ->> 'nome' = 'Secretaria Um'),
  'a árvore do administrador mostra quem é da secretaria');

SELECT pg_temp.como('admB');
SELECT pg_temp.falha($$SELECT public.admin_designar_secretaria(pg_temp.id('s1'), 'intruso@b.local')$$,
  'Quem designa as pessoas da secretaria', 'admin de outra organização não designa');
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.secretaria_pessoas), 'admin de outra organização não lê as pessoas da secretaria');

-- ── 3. gestor de unidade ───────────────────────────────────────────────────
SELECT pg_temp.como('gest');
SELECT pg_temp.falha($$SELECT public.admin_designar_secretaria(pg_temp.id('s1'), 'gest@secretaria.local')$$,
  'Quem designa as pessoas da secretaria', 'gestor de unidade não designa pessoa da secretaria');
SELECT pg_temp.falha($$SELECT public.admin_salvar_secretaria(pg_temp.id('s1'), NULL, 'Tomada pelo gestor')$$,
  'Quem cadastra a secretaria', 'gestor de unidade não edita a secretaria');
SELECT pg_temp.falha($$SELECT public.rede_arvore_da_secretaria()$$, 'A rede da secretaria', 'gestor de unidade não abre a rede da secretaria');
SELECT pg_temp.ok((SELECT public.minhas_secretarias() = '[]'::jsonb), 'gestor de unidade não tem secretaria');
SELECT pg_temp.ok(pg_temp.linhas($$UPDATE public.unidades SET raio_metros = 900 WHERE id = pg_temp.id('hosA')$$) = 0,
  'gestor de uma unidade não edita outra unidade da secretaria');
SELECT pg_temp.ok(pg_temp.linhas($$UPDATE public.unidades SET raio_metros = 650 WHERE id = pg_temp.id('upaA')$$) = 1,
  'gestor segue editando a própria unidade');

-- ── 2. a secretaria edita as unidades dela ─────────────────────────────────
SELECT pg_temp.como('secA');
WITH m AS (SELECT public.minhas_secretarias() AS j)
SELECT pg_temp.ok((SELECT jsonb_array_length(j) = 1 AND j -> 0 ->> 'nome' = 'Secretaria Um'
                          AND jsonb_array_length(j -> 0 -> 'unidades') = 2 FROM m),
  'minhas_secretarias traz a secretaria com as duas unidades dela');
WITH a AS (SELECT public.rede_arvore_da_secretaria() AS j)
SELECT pg_temp.ok((SELECT jsonb_array_length(j -> 0 -> 'secretarias') = 1 AND jsonb_array_length(j -> 0 -> 'unidades') = 2
                          AND NOT (j::text LIKE '%Clínica A do perfil%') FROM a),
  'a rede da secretaria traz só ela e as unidades dela');
SELECT pg_temp.falha($$SELECT public.admin_rede_arvore()$$, 'A rede é do administrador', 'a secretaria não abre a árvore do administrador');
SELECT pg_temp.falha($$SELECT public.admin_designar_secretaria(pg_temp.id('s1'), 'colega@secretaria.local')$$,
  'Quem designa as pessoas da secretaria', 'a secretaria não designa outra pessoa');
SELECT pg_temp.falha($$SELECT public.admin_salvar_secretaria(pg_temp.id('s1'), NULL, 'Renomeada')$$,
  'Quem cadastra a secretaria', 'a secretaria não edita o cadastro da secretaria');
SELECT pg_temp.falha($$SELECT public.admin_unidade_na_rede(pg_temp.id('upaA'), NULL, NULL)$$,
  'Quem organiza a rede', 'a secretaria não tira unidade da rede');

SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.unidades WHERE organizacao_id = pg_temp.id('orgA')), 'a secretaria lê só as unidades dela');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.secretarias), 'a secretaria lê a própria secretaria');
SELECT pg_temp.ok(pg_temp.linhas($$UPDATE public.unidades SET raio_metros = 300, whatsapp_numero = '62999990000' WHERE id = pg_temp.id('hosA')$$) = 1,
  'a secretaria edita a configuração da unidade dela');
SELECT pg_temp.ok(pg_temp.linhas($$UPDATE public.unidades SET raio_metros = 300 WHERE id = pg_temp.id('ubsA')$$) = 0,
  'a secretaria não edita unidade de outra secretaria');
SELECT pg_temp.falha($$UPDATE public.unidades SET secretaria_id = NULL WHERE id = pg_temp.id('hosA')$$,
  'permission denied', 'a secretaria não tira a unidade da secretaria pela tabela');

INSERT INTO public.setores (unidade_id, nome, tipo, ordem) VALUES (pg_temp.id('hosA'), 'Enfermaria nova', 'internacao', 9);
INSERT INTO public.leitos (setor_id, identificador, tipo)
SELECT id, 'EN0' || g, 'clinico' FROM public.setores, generate_series(1, 3) g WHERE nome = 'Enfermaria nova' AND unidade_id = pg_temp.id('hosA');
SELECT pg_temp.ok((SELECT count(*) = 3 FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id WHERE s.nome = 'Enfermaria nova'),
  'a secretaria cria setor e leitos na unidade dela');
SELECT pg_temp.ok(pg_temp.linhas($$UPDATE public.leitos SET tipo = 'isolamento' WHERE identificador = 'EN01'$$) = 1,
  'a secretaria muda o tipo do leito');
SELECT pg_temp.ok(pg_temp.linhas($$DELETE FROM public.leitos WHERE identificador = 'EN03'$$) = 1,
  'a secretaria exclui leito da unidade dela');
SELECT pg_temp.falha($$INSERT INTO public.setores (unidade_id, nome, tipo, ordem) VALUES (pg_temp.id('ubsA'), 'Intrusa', 'observacao', 1)$$,
  'new row violates row-level security', 'a secretaria não cria setor em unidade de outra secretaria');
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.setores WHERE nome = 'Sala da UBS'),
  'a secretaria não lê setor de unidade de outra secretaria');

SELECT public.definir_cnes_unidade(pg_temp.id('hosA'), '9753108');
SELECT pg_temp.ok((SELECT cnes = '9753108' FROM public.unidades WHERE id = pg_temp.id('hosA')), 'a secretaria preenche o CNES da unidade dela');
SELECT pg_temp.falha($$SELECT public.definir_cnes_unidade(pg_temp.id('ubsA'), '7654321')$$,
  'O CNES da unidade é preenchido pelo gestor', 'a secretaria não preenche CNES de outra secretaria');
SELECT pg_temp.ok((SELECT public.escala_mes_gestor(pg_temp.id('hosA'), 2026, 12) IS NOT NULL), 'a secretaria abre a escala do mês da unidade dela');
SELECT pg_temp.falha($$SELECT public.escala_mes_gestor(pg_temp.id('ubsA'), 2026, 12)$$,
  'Acesso negado', 'a secretaria não abre a escala de outra secretaria');
-- a vaga pode parar no turno da unidade (cenário sem turnos); o que se
-- confere aqui é que a permissão passou
SELECT pg_temp.passa($$SELECT public.marcar_vaga_escala(s.id, current_date + 7, 'diurno', NULL, 'plantonista')
                       FROM public.setores s WHERE s.nome = 'Enfermaria nova'$$,
  'Só o gestor da unidade marca vaga', 'a secretaria marca vaga na escala da unidade dela');
SELECT pg_temp.falha($$SELECT public.marcar_vaga_escala(pg_temp.id('setOutra'), current_date + 7, 'diurno', NULL, 'plantonista')$$,
  'Só o gestor da unidade marca vaga', 'a secretaria não marca vaga em unidade de outra secretaria');
SELECT pg_temp.passa($$SELECT public.convites_da_unidade(pg_temp.id('hosA'))$$,
  'Só o gestor da unidade vê os convites', 'a secretaria vê os convites da unidade dela');
SELECT pg_temp.falha($$SELECT public.convites_da_unidade(pg_temp.id('ubsA'))$$,
  'Só o gestor da unidade vê os convites', 'a secretaria não vê os convites de outra secretaria');

-- ── 4. designação pendente ─────────────────────────────────────────────────
RESET ROLE;
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (pg_temp.id('novo'), 'Novo@Secretaria.local', now());
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.id('novo'), 'Pessoa novo')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('novo');
SELECT pg_temp.ok((SELECT public.minhas_secretarias() -> 0 ->> 'nome' = 'Secretaria Um'), 'a designação pendente vale quando a pessoa entra');
SELECT pg_temp.ok((SELECT perfil_id = pg_temp.id('novo') AND aceito_em IS NOT NULL FROM public.secretaria_pessoas WHERE email = 'novo@secretaria.local'),
  'a designação fica ligada à conta');

-- ── 5. retirar ─────────────────────────────────────────────────────────────
SELECT pg_temp.como('admA');
SELECT public.admin_retirar_secretaria((SELECT id FROM public.secretaria_pessoas WHERE email = 'seca@secretaria.local'));
SELECT pg_temp.como('secA');
SELECT pg_temp.ok((SELECT public.minhas_secretarias() = '[]'::jsonb), 'retirada, a pessoa perde a secretaria');
SELECT pg_temp.ok(pg_temp.linhas($$UPDATE public.unidades SET raio_metros = 200 WHERE id = pg_temp.id('hosA')$$) = 0,
  'retirada, a pessoa não edita mais a unidade');
SELECT pg_temp.falha($$SELECT public.rede_arvore_da_secretaria()$$, 'A rede da secretaria', 'retirada, a pessoa não abre a rede');

-- ── 6. sem vínculo do perfil novo; auditoria ───────────────────────────────
RESET ROLE;
DO $$
BEGIN
  BEGIN
    EXECUTE $q$INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES ('00000000-0000-4000-8000-0000000053aa', '00000000-0000-4000-8000-0000000053a4', 'gestor_secretaria')$q$;
  EXCEPTION
    -- 23514: a regra vinculos_sem_perfil_secretaria; 55P04: o valor do enum
    -- nasceu nesta mesma transação (só quando o teste roda junto da migration)
    WHEN check_violation OR SQLSTATE '55P04' THEN RAISE NOTICE 'OK  o perfil Secretaria não vira vínculo'; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: vínculo com o perfil Secretaria passou';
END $$;
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.log_auditoria WHERE acao = 'secretaria_pessoa_designada'
                     AND entidade_id IN (SELECT id FROM public.secretaria_pessoas WHERE secretaria_id = pg_temp.id('s1'))),
  'auditoria das designações');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.log_auditoria WHERE acao = 'secretaria_pessoa_aceita'
                     AND entidade_id IN (SELECT id FROM public.secretaria_pessoas WHERE secretaria_id = pg_temp.id('s1'))),
  'auditoria da designação aceita');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.log_auditoria WHERE acao = 'secretaria_pessoa_retirada'
                     AND entidade_id IN (SELECT id FROM public.secretaria_pessoas WHERE secretaria_id = pg_temp.id('s1'))),
  'auditoria da retirada');

SELECT 'secretaria_perfil ok' AS resultado;
ROLLBACK;
