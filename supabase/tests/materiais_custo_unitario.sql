-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270422000090_materiais_custo_unitario.sql (custo
-- unitário dos materiais, RT em 24/11/2026). Tudo em transação com ROLLBACK;
-- o cenário é criado aqui. Vale com ou sem a 20270421000073 (o gestor cadastra
-- nos dois casos).
--
-- 1. quem define o custo: gestor e farmacêutico sim; faturamento e recepção
--    não; custo negativo, com 3 casas ou de outra unidade recusado; limpar;
-- 2. auditoria com o custo anterior e o novo;
-- 3. o lançamento congela o custo; mudar o custo depois não mexe na linha;
--    valor = quantidade × custo; sem custo = valor nulo; total da conta;
-- 4. materiais_da_unidade mostra o custo; sem acesso direto às tabelas.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000090a1'),
  ('upa',  '00000000-0000-4000-8000-0000000090a2'),
  ('setor','00000000-0000-4000-8000-0000000090a3'),
  ('outra','00000000-0000-4000-8000-0000000090a4'),
  ('fat',  '00000000-0000-4000-8000-0000000090b1'),
  ('ges',  '00000000-0000-4000-8000-0000000090b2'),
  ('rec',  '00000000-0000-4000-8000-0000000090b3'),
  ('far',  '00000000-0000-4000-8000-0000000090b4'),
  ('gviz', '00000000-0000-4000-8000-0000000090b5'),
  ('pac',  '00000000-0000-4000-8000-0000000090c1'),
  ('ep',   '00000000-0000-4000-8000-0000000090c2');
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
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
-- a linha de um material na conta
CREATE FUNCTION pg_temp.linha(p_material text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT m FROM jsonb_array_elements(public.conta_detalhe(pg_temp.v('conta')) -> 'materiais') m
   WHERE (m ->> 'material_id')::uuid = pg_temp.v(p_material) AND m ->> 'retirado_em' IS NULL
$$;
GRANT EXECUTE ON FUNCTION pg_temp.linha(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@custo.local' FROM ids WHERE nome IN ('fat', 'ges', 'rec', 'far', 'gviz');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('fat', 'ges', 'rec', 'far', 'gviz')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do custo');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do custo', 'upa', '9990901'),
  (pg_temp.id('outra'), pg_temp.id('org'), 'UPA vizinha do custo', 'upa', '9990902');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('upa'), 'Porta', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('fat'), pg_temp.id('upa'), 'faturamento'), (pg_temp.id('ges'), pg_temp.id('upa'), 'gestor'),
  (pg_temp.id('rec'), pg_temp.id('upa'), 'recepcao'), (pg_temp.id('far'), pg_temp.id('upa'), 'farmaceutico'),
  (pg_temp.id('gviz'), pg_temp.id('outra'), 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo) VALUES
  (pg_temp.id('pac'), pg_temp.id('upa'), 'Paciente do custo', '1980-01-01', 'F');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES (pg_temp.id('ep'), pg_temp.id('upa'), pg_temp.id('pac'), pg_temp.id('setor'), 'atendimento', 'Corte na mão', pg_temp.id('rec'), now() - interval '2 hours');
INSERT INTO v SELECT 'conta', id FROM public.contas WHERE episodio_id = pg_temp.id('ep');

SET LOCAL ROLE authenticated;

-- ── 1. quem define o custo ──────────────────────────────────────────────────
SELECT pg_temp.como('ges');
INSERT INTO v SELECT 'gaze', public.material_salvar(pg_temp.id('upa'), NULL, 'Gaze estéril', 'pacote');
INSERT INTO v SELECT 'luva', public.material_salvar(pg_temp.id('upa'), NULL, 'Luva de procedimento', 'par');
SELECT pg_temp.ok((SELECT m ? 'custo_unitario' AND m -> 'custo_unitario' = 'null'::jsonb
                     FROM jsonb_array_elements(public.materiais_da_unidade(pg_temp.id('upa'))) m
                    WHERE (m ->> 'id')::uuid = pg_temp.v('gaze')),
  'material novo começa sem custo');
SELECT pg_temp.como('fat');
SELECT pg_temp.falha(format('SELECT public.material_definir_custo(%L, 2.5)', pg_temp.v('gaze')),
  'Acesso negado: o custo do material', 'o faturamento não define custo');
SELECT pg_temp.como('rec');
SELECT pg_temp.falha(format('SELECT public.material_definir_custo(%L, 2.5)', pg_temp.v('gaze')),
  'Acesso negado: o custo do material', 'a recepção não define custo');
SELECT pg_temp.como('gviz');
SELECT pg_temp.falha(format('SELECT public.material_definir_custo(%L, 2.5)', pg_temp.v('gaze')),
  'Acesso negado: o custo do material', 'gestor de outra unidade não define custo');
SELECT pg_temp.como('far');
SELECT pg_temp.falha(format('SELECT public.material_definir_custo(%L, -1)', pg_temp.v('gaze')),
  'Custo unitário de R$ 0,00', 'custo negativo recusado');
SELECT pg_temp.falha(format('SELECT public.material_definir_custo(%L, 1.255)', pg_temp.v('gaze')),
  'Custo unitário de R$ 0,00', 'custo com 3 casas recusado');
SELECT pg_temp.falha(format('SELECT public.material_definir_custo(%L, 100000000)', pg_temp.v('gaze')),
  'Custo unitário de R$ 0,00', 'custo acima do teto recusado');
SELECT public.material_definir_custo(pg_temp.v('gaze'), 2.5);
SELECT pg_temp.como('ges');
SELECT public.material_definir_custo(pg_temp.v('luva'), 0.9);
SELECT public.material_definir_custo(pg_temp.v('luva'), NULL);
SELECT pg_temp.ok((SELECT (m ->> 'custo_unitario')::numeric FROM jsonb_array_elements(public.materiais_da_unidade(pg_temp.id('upa'))) m
                    WHERE (m ->> 'id')::uuid = pg_temp.v('gaze')) = 2.5
                  AND (SELECT m ->> 'custo_unitario' FROM jsonb_array_elements(public.materiais_da_unidade(pg_temp.id('upa'))) m
                        WHERE (m ->> 'id')::uuid = pg_temp.v('luva')) IS NULL,
  'farmacêutico e gestor definem; limpar deixa sem custo');

-- ── 2. auditoria ────────────────────────────────────────────────────────────
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria
                    WHERE acao = 'material_custo_alterado' AND entidade_id = pg_temp.v('luva')) = 2
                  AND EXISTS (SELECT 1 FROM public.log_auditoria
                               WHERE acao = 'material_custo_alterado' AND entidade_id = pg_temp.v('luva')
                                 AND (payload ->> 'custo_anterior')::numeric = 0.9 AND payload -> 'custo_novo' = 'null'::jsonb),
  'auditoria com o custo anterior e o novo');
SET LOCAL ROLE authenticated;

-- ── 3. lançamento congela o custo ───────────────────────────────────────────
SELECT pg_temp.como('fat');
SELECT public.conta_lancar_material(pg_temp.v('conta'), pg_temp.v('gaze'), 3);
SELECT public.conta_lancar_material(pg_temp.v('conta'), pg_temp.v('luva'), 2);
SELECT pg_temp.ok((pg_temp.linha('gaze') ->> 'custo_unitario')::numeric = 2.5
                  AND (pg_temp.linha('gaze') ->> 'valor')::numeric = 7.5,
  'gaze: 3 × R$ 2,50 = R$ 7,50');
SELECT pg_temp.ok(pg_temp.linha('luva') ->> 'custo_unitario' IS NULL AND pg_temp.linha('luva') ->> 'valor' IS NULL,
  'luva sem custo: valor nulo (não zero)');
SELECT pg_temp.ok((public.conta_detalhe(pg_temp.v('conta')) ->> 'materiais_total')::numeric = 7.5,
  'total da conta soma só o que tem custo');
SELECT pg_temp.como('far');
SELECT public.material_definir_custo(pg_temp.v('gaze'), 4);
SELECT pg_temp.como('fat');
SELECT pg_temp.ok((pg_temp.linha('gaze') ->> 'custo_unitario')::numeric = 2.5,
  'mudar o custo depois não reescreve o lançamento');
SELECT public.conta_lancar_material(pg_temp.v('conta'), pg_temp.v('gaze'), 1.5);
SELECT pg_temp.ok((public.conta_detalhe(pg_temp.v('conta')) ->> 'materiais_total')::numeric = 13.5,
  'novo lançamento com o custo novo: 7,50 + 1,5 × 4,00 = 13,50');
INSERT INTO v SELECT 'lanc_luva', (m ->> 'id')::uuid FROM jsonb_array_elements(public.conta_detalhe(pg_temp.v('conta')) -> 'materiais') m
 WHERE (m ->> 'material_id')::uuid = pg_temp.v('luva');
SELECT public.conta_retirar_material(pg_temp.v('lanc_luva'), 'Lançada por engano nesta conta');
INSERT INTO v SELECT 'lanc_gaze1', (m ->> 'id')::uuid FROM jsonb_array_elements(public.conta_detalhe(pg_temp.v('conta')) -> 'materiais') m
 WHERE (m ->> 'material_id')::uuid = pg_temp.v('gaze') AND (m ->> 'quantidade')::numeric = 3;
SELECT public.conta_retirar_material(pg_temp.v('lanc_gaze1'), 'Quantidade lançada errada na conta');
SELECT pg_temp.ok((public.conta_detalhe(pg_temp.v('conta')) ->> 'materiais_total')::numeric = 6,
  'retirado sai do total');

-- ── 4. fechamento e acesso ──────────────────────────────────────────────────
RESET ROLE;
UPDATE public.contas SET status = 'fechada', materiais_congelados = private.conta_materiais(c), congelada_em = now()
  FROM public.contas c WHERE c.id = pg_temp.v('conta') AND public.contas.id = c.id;
UPDATE public.materiais_unidade SET custo_unitario = 99 WHERE id = pg_temp.v('gaze');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('fat');
SELECT pg_temp.ok((public.conta_detalhe(pg_temp.v('conta')) ->> 'materiais_total')::numeric = 6,
  'conta fechada guarda o valor congelado');
RESET ROLE;
SELECT pg_temp.ok(has_table_privilege('authenticated', 'public.materiais_unidade', 'UPDATE') IS FALSE
                  AND has_table_privilege('authenticated', 'public.conta_materiais', 'UPDATE') IS FALSE
                  AND has_function_privilege('anon', 'public.material_definir_custo(uuid, numeric)', 'EXECUTE') IS FALSE,
  'sem escrita direta nas tabelas; anon não chama a RPC');

ROLLBACK;
