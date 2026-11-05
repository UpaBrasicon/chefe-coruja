-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270226000001_materiais.sql (pendências da 5B, L4).
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. cadastro da unidade: faturamento e gestor cadastram; recepção não; nome
--    repetido e código fora do grupo 07 recusados; desativar;
-- 2. lançamento na conta: só o faturamento, só material ativo da unidade,
--    quantidade positiva; retirada com motivo; histórico na conta;
-- 3. pré-auditoria: material sem código SIGTAP só avisa;
-- 4. a conta congela os materiais no fechamento; fechada não aceita lançamento.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000064a1'),
  ('upa',  '00000000-0000-4000-8000-0000000064a2'),
  ('setor','00000000-0000-4000-8000-0000000064a3'),
  ('outra','00000000-0000-4000-8000-0000000064a4'),
  ('fat',  '00000000-0000-4000-8000-0000000064b1'),
  ('ges',  '00000000-0000-4000-8000-0000000064b2'),
  ('rec',  '00000000-0000-4000-8000-0000000064b3'),
  ('pac',  '00000000-0000-4000-8000-0000000064c1'),
  ('ep',   '00000000-0000-4000-8000-0000000064c2');
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
-- um procedimento do grupo 07 do SIGTAP carregado (qualquer um serve)
CREATE FUNCTION pg_temp.opm() RETURNS text LANGUAGE sql AS $$ SELECT min(codigo) FROM terminologia.sigtap_procedimento WHERE codigo LIKE '07%' $$;
GRANT EXECUTE ON FUNCTION pg_temp.opm() TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5bmat.local' FROM ids WHERE nome IN ('fat', 'ges', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('fat', 'ges', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede dos materiais');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA dos materiais', 'upa', '9996401'),
  (pg_temp.id('outra'), pg_temp.id('org'), 'UPA vizinha', 'upa', '9996402');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('setor'), pg_temp.id('upa'), 'Porta', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('fat'), pg_temp.id('upa'), 'faturamento'), (pg_temp.id('ges'), pg_temp.id('upa'), 'gestor'),
  (pg_temp.id('rec'), pg_temp.id('upa'), 'recepcao');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo) VALUES
  (pg_temp.id('pac'), pg_temp.id('upa'), 'Paciente dos materiais', '1980-01-01', 'F');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES (pg_temp.id('ep'), pg_temp.id('upa'), pg_temp.id('pac'), pg_temp.id('setor'), 'atendimento', 'Corte no braço', pg_temp.id('rec'), now() - interval '2 hours');
INSERT INTO v SELECT 'conta', id FROM public.contas WHERE episodio_id = pg_temp.id('ep');

SET LOCAL ROLE authenticated;

-- ── 1. cadastro ─────────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha(format('SELECT public.material_salvar(%L, NULL, %L, %L)', pg_temp.id('upa'), 'Gaze estéril', 'pacote'),
  'Acesso negado: os materiais', 'recepção não cadastra');
SELECT pg_temp.como('ges');
INSERT INTO v SELECT 'gaze', public.material_salvar(pg_temp.id('upa'), NULL, 'Gaze estéril', 'pacote');
SELECT pg_temp.como('fat');
INSERT INTO v SELECT 'fio', public.material_salvar(pg_temp.id('upa'), NULL, 'Fio de sutura', 'unidade', pg_temp.opm());
SELECT pg_temp.falha(format('SELECT public.material_salvar(%L, NULL, %L, %L)', pg_temp.id('upa'), 'gaze estéril ', 'pacote'),
  'Já existe um material ativo', 'nome repetido recusado');
SELECT pg_temp.falha(format('SELECT public.material_salvar(%L, NULL, %L, %L, %L)', pg_temp.id('upa'), 'Seringa', 'unidade', '0301060096'),
  'O código SIGTAP de material é do grupo 07', 'código fora do grupo 07 recusado');
INSERT INTO v SELECT 'luva', public.material_salvar(pg_temp.id('upa'), NULL, 'Luva de procedimento', 'par');
SELECT public.material_salvar(pg_temp.id('upa'), pg_temp.v('luva'), 'Luva de procedimento', 'par', NULL, false);
SELECT pg_temp.ok(jsonb_array_length(public.materiais_da_unidade(pg_temp.id('upa'))) = 3
                  AND (SELECT (m ->> 'ativo')::boolean FROM jsonb_array_elements(public.materiais_da_unidade(pg_temp.id('upa'))) m
                        WHERE (m ->> 'id')::uuid = pg_temp.v('luva')) IS FALSE,
  'faturamento e gestor cadastram; a luva fica desativada');

-- ── 2. lançamento ───────────────────────────────────────────────────────────
SELECT pg_temp.como('ges');
SELECT pg_temp.falha(format('SELECT public.conta_lancar_material(%L, %L, 2)', pg_temp.v('conta'), pg_temp.v('gaze')),
  'Acesso negado: o lançamento na conta', 'o gestor não lança');
SELECT pg_temp.como('fat');
SELECT pg_temp.falha(format('SELECT public.conta_lancar_material(%L, %L, 1)', pg_temp.v('conta'), pg_temp.v('luva')),
  'Material não está ativo', 'material desativado não lança');
SELECT pg_temp.falha(format('SELECT public.conta_lancar_material(%L, %L, 0)', pg_temp.v('conta'), pg_temp.v('gaze')),
  'Quantidade maior que zero', 'quantidade zero recusada');
SELECT public.conta_lancar_material(pg_temp.v('conta'), pg_temp.v('gaze'), 3, 'Curativo do corte');
SELECT public.conta_lancar_material(pg_temp.v('conta'), pg_temp.v('fio'), 1);
SELECT pg_temp.ok(jsonb_array_length(public.conta_detalhe(pg_temp.v('conta')) -> 'materiais') = 2,
  'dois materiais lançados na conta');
INSERT INTO v SELECT 'lanc_fio', (m ->> 'id')::uuid FROM jsonb_array_elements(public.conta_detalhe(pg_temp.v('conta')) -> 'materiais') m
 WHERE (m ->> 'material_id')::uuid = pg_temp.v('fio');
SELECT pg_temp.falha(format('SELECT public.conta_retirar_material(%L, %L)', pg_temp.v('lanc_fio'), 'Engano'), 'Escreva o motivo', 'retirada pede motivo');
SELECT public.conta_retirar_material(pg_temp.v('lanc_fio'), 'Lançado em duplicidade com a sutura');
SELECT pg_temp.ok((SELECT (m ->> 'retirado_em') IS NOT NULL FROM jsonb_array_elements(public.conta_detalhe(pg_temp.v('conta')) -> 'materiais') m
                    WHERE (m ->> 'id')::uuid = pg_temp.v('lanc_fio')),
  'retirada com motivo fica no histórico da linha');
SELECT pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(public.conta_detalhe(pg_temp.v('conta')) -> 'eventos') e
                    WHERE e ->> 'evento' IN ('material_lancado', 'material_retirado')) = 3, 'lançamentos e retirada nos eventos da conta');

-- ── 3. pré-auditoria ────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(public.conta_detalhe(pg_temp.v('conta')) -> 'pendencias') p
                    WHERE p ->> 'codigo' = 'material_sem_sigtap' AND NOT (p ->> 'bloqueante')::boolean) = 1,
  'gaze sem código SIGTAP só avisa; o fio retirado não conta');

-- ── 4. fechamento ───────────────────────────────────────────────────────────
RESET ROLE;
UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now(), desfecho_em = now() WHERE id = pg_temp.id('ep');
UPDATE public.contas SET status = 'fechada', materiais_congelados = private.conta_materiais(c), congelada_em = now()
  FROM public.contas c WHERE c.id = pg_temp.v('conta') AND public.contas.id = c.id;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('fat');
SELECT pg_temp.falha(format('SELECT public.conta_lancar_material(%L, %L, 1)', pg_temp.v('conta'), pg_temp.v('gaze')),
  'Conta fechada', 'conta fechada não aceita lançamento');
SELECT pg_temp.ok(jsonb_array_length(public.conta_detalhe(pg_temp.v('conta')) -> 'materiais') = 2, 'conta fechada mostra os materiais congelados');
-- o fechamento pela RPC congela os materiais (trecho trocado em mudar_etapa_conta)
RESET ROLE;
SELECT pg_temp.ok(position('materiais_congelados = CASE WHEN p_para = ''fechada'' THEN private.conta_materiais(c)'
                           IN pg_get_functiondef('public.mudar_etapa_conta(uuid, text, text)'::regprocedure)) > 0,
  'mudar_etapa_conta congela os materiais no fechamento');
SELECT pg_temp.ok(has_table_privilege('authenticated', 'public.materiais_unidade', 'SELECT') IS FALSE
                  AND has_table_privilege('authenticated', 'public.conta_materiais', 'SELECT') IS FALSE, 'sem acesso direto às tabelas');

ROLLBACK;
