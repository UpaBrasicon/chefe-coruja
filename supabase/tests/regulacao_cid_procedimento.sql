-- Testes da migration 20270423000010 (CID compatível com o procedimento,
-- aviso do pedido novo e o que o regulador vê). Dados próprios, sem o seed;
-- procedimentos de teste fora da faixa do SIGTAP. ROLLBACK no fim: nada grava.
-- Cobre:
-- - a lista de CID do procedimento (tem_lista, total, compativel) e o
--   procedimento sem lista (livre);
-- - regulacao_solicitar recusa o CID fora da lista com a mensagem da tela e
--   aceita o da lista; procedimento sem lista aceita qualquer CID válido;
-- - o reenvio troca o CID: fora da lista também é recusado;
-- - o aviso "Novo pedido de regulação nº N" vai ao gestor e ao NIR da origem
--   e ao regulador da central, e não a quem abriu nem a outro médico;
-- - o painel de prazos da origem: o regulador que só tem esse papel ali vê os
--   pedidos que vão à central onde ele regula; o que não regula a central vê
--   a lista vazia (sem erro); quem não tem papel nenhum, "Acesso negado";
-- - internados sem laudo: regulador e gestor abrem, o médico não.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES
  ('J18.9', 'Pneumonia não especificada'), ('I10', 'Hipertensão essencial (primária)'), ('B01.2', 'Varicela com pneumopatia')
ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0399999901', 'PROCEDIMENTO DE TESTE COM LISTA DE CID', '2', 'I', 0, 1560, '209912'),
  ('0399999902', 'PROCEDIMENTO DE TESTE SEM LISTA DE CID', '2', 'I', 0, 1560, '209912')
ON CONFLICT DO NOTHING;
-- a lista do procedimento com lista: J18.9 e B01.2 (I10 fica de fora)
INSERT INTO terminologia.sigtap_procedimento_cid (procedimento, cid, principal, competencia) VALUES
  ('0399999901', 'J18.9', true, '209912'), ('0399999901', 'B01.2', true, '209912')
ON CONFLICT (procedimento, cid) DO UPDATE SET principal = excluded.principal, competencia = excluded.competencia;

INSERT INTO auth.users (id, email)
SELECT ('ad000000-0000-4000-8000-00000000000' || n)::uuid, 'cidproc' || n || '@regulacao.local' FROM generate_series(1, 7) n
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('ad000000-0000-4000-8000-000000000001', 'Médico da UPA'),
  ('ad000000-0000-4000-8000-000000000002', 'Gestor da UPA'),
  ('ad000000-0000-4000-8000-000000000003', 'NIR da UPA'),
  ('ad000000-0000-4000-8000-000000000004', 'Regulador da central'),
  ('ad000000-0000-4000-8000-000000000005', 'Regulador da central e da UPA'),
  ('ad000000-0000-4000-8000-000000000006', 'Regulador só da UPA'),
  ('ad000000-0000-4000-8000-000000000007', 'Outro médico da UPA')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES ('ad100000-0000-4000-8000-000000000001', 'Rede CID × procedimento');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  ('ad200000-0000-4000-8000-000000000001', 'ad100000-0000-4000-8000-000000000001', 'Central do teste', 'clinica', NULL),
  ('ad200000-0000-4000-8000-000000000002', 'ad100000-0000-4000-8000-000000000001', 'UPA do teste', 'upa', '7650001');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('ad000000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000002', 'plantonista'),
  ('ad000000-0000-4000-8000-000000000002', 'ad200000-0000-4000-8000-000000000002', 'gestor'),
  ('ad000000-0000-4000-8000-000000000003', 'ad200000-0000-4000-8000-000000000002', 'nir'),
  ('ad000000-0000-4000-8000-000000000004', 'ad200000-0000-4000-8000-000000000001', 'regulador'),
  ('ad000000-0000-4000-8000-000000000005', 'ad200000-0000-4000-8000-000000000001', 'regulador'),
  ('ad000000-0000-4000-8000-000000000005', 'ad200000-0000-4000-8000-000000000002', 'regulador'),
  ('ad000000-0000-4000-8000-000000000006', 'ad200000-0000-4000-8000-000000000002', 'regulador'),
  ('ad000000-0000-4000-8000-000000000007', 'ad200000-0000-4000-8000-000000000002', 'plantonista');
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por) VALUES
  ('ad100000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000004');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo) VALUES
  ('ad300000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000002', 'Paciente do teste', '1960-03-03', 'CP-1', 'M');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
CREATE FUNCTION pg_temp.igual(p_obtido text, p_esperado text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtido IS DISTINCT FROM p_esperado THEN
    RAISE EXCEPTION 'FALHOU: % — esperado %, veio %', p_ok, p_esperado, p_obtido;
  END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.ids(p jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(e->>'id', ',' ORDER BY e->>'id'), '') FROM jsonb_array_elements(p) e $$;
-- o pedido do teste, com o procedimento e o CID dados
CREATE FUNCTION pg_temp.dados(p_proc text, p_cid text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('tipo', 'leito', 'tipo_leito', 'clinico', 'procedimento', p_proc, 'carater', 'urgencia',
    'prioridade', 'urgencia', 'cid', p_cid, 'destino_tipo', 'a_definir', 'paciente_nao_identificado', true,
    'quadro_clinico', 'Febre, tosse produtiva e dispneia há três dias, estertores em base direita.') $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.igual(text, text, text),
  pg_temp.ids(jsonb), pg_temp.dados(text, text) TO authenticated, anon;

-- ── 1. a lista de CID do procedimento ───────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('ad000000-0000-4000-8000-000000000001');
SELECT pg_temp.igual((SELECT (r->>'tem_lista') || ':' || (r->>'total') || ':' || (r->>'compativel')
                        FROM public.regulacao_cids_do_procedimento('0399999901', NULL, 'I10') r),
  'true:2:false', 'o procedimento tem 2 CID na lista, e I10 não está nela');
SELECT pg_temp.igual((public.regulacao_cids_do_procedimento('03.99.99.990-1', NULL, 'J189')->>'compativel'),
  'true', 'J189 (sem ponto) está na lista; o código do procedimento aceita pontuação');
SELECT pg_temp.igual((SELECT string_agg(e->>'codigo', ',') FROM jsonb_array_elements(public.regulacao_cids_do_procedimento('0399999901', 'varicela')->'itens') e),
  'B01.2', 'a busca por descrição acha só o CID dela');
SELECT pg_temp.igual((SELECT (r->>'tem_lista') || ':' || coalesce(r->>'compativel', 'nulo')
                        FROM public.regulacao_cids_do_procedimento('0399999902', NULL, 'I10') r),
  'false:nulo', 'procedimento sem lista: busca livre');

-- ── 2. o pedido com CID fora da lista é recusado ────────────────────────────
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('ad200000-0000-4000-8000-000000000002', 'ad300000-0000-4000-8000-000000000001',
    pg_temp.dados('0399999901', 'I10'))$$,
  'O CID I10 não é compatível com o procedimento 0399999901 no SIGTAP. Escolha um CID da lista do procedimento',
  'o médico não envia o pedido com I10 no procedimento que não o aceita');
INSERT INTO t SELECT 'ok', r->>'id' FROM (SELECT public.regulacao_solicitar('ad200000-0000-4000-8000-000000000002',
  'ad300000-0000-4000-8000-000000000001', pg_temp.dados('0399999901', 'J18.9')) r) x;
SELECT pg_temp.igual((SELECT count(*)::text FROM t WHERE nome = 'ok' AND valor IS NOT NULL), '1', 'o CID da lista entra');
INSERT INTO t SELECT 'livre', r->>'id' FROM (SELECT public.regulacao_solicitar('ad200000-0000-4000-8000-000000000002',
  'ad300000-0000-4000-8000-000000000001', pg_temp.dados('0399999902', 'I10')) r) x;
SELECT pg_temp.igual((SELECT count(*)::text FROM t WHERE nome = 'livre' AND valor IS NOT NULL), '1', 'procedimento sem lista aceita qualquer CID válido');
RESET ROLE;

-- o reenvio que troca o CID também passa pela regra (o gatilho vale em toda troca)
SELECT pg_temp.falha(format($$UPDATE public.regulacao_solicitacoes SET cid = 'I10' WHERE id = %L$$, pg_temp.v('ok')),
  'O CID I10 não é compatível', 'trocar o CID para um fora da lista é recusado');
WITH x AS (UPDATE public.regulacao_solicitacoes SET telefone_contato = '(00) 0000-0000' WHERE id = pg_temp.v('ok')::uuid RETURNING 1)
SELECT pg_temp.igual((SELECT count(*)::text FROM x), '1', 'mudar outro campo não passa pela regra');

-- ── 3. o aviso do pedido novo ───────────────────────────────────────────────
SELECT pg_temp.igual((SELECT string_agg(p.nome_completo, ',' ORDER BY p.nome_completo)
                        FROM public.notificacoes_plantonista n JOIN public.perfis p ON p.id = n.perfil_id
                       WHERE n.tipo = 'reg_novo_' || (SELECT numero FROM public.regulacao_solicitacoes WHERE id = pg_temp.v('ok')::uuid)),
  'Gestor da UPA,NIR da UPA,Regulador da central,Regulador da central e da UPA',
  'o aviso vai ao gestor e ao NIR da origem e aos reguladores da central; não a quem abriu nem a outro médico');
SELECT pg_temp.igual((SELECT n.mensagem FROM public.notificacoes_plantonista n
                       WHERE n.perfil_id = 'ad000000-0000-4000-8000-000000000004'
                         AND n.tipo = 'reg_novo_' || (SELECT numero FROM public.regulacao_solicitacoes WHERE id = pg_temp.v('ok')::uuid)),
  'Novo pedido de regulação nº ' || (SELECT numero FROM public.regulacao_solicitacoes WHERE id = pg_temp.v('ok')::uuid) || ' de UPA do teste.',
  'o regulador lê de que unidade veio');

-- ── 4. o painel de prazos da origem para o regulador ────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('ad000000-0000-4000-8000-000000000005');
SELECT pg_temp.igual(pg_temp.ids(public.regulacao_sla_painel('ad200000-0000-4000-8000-000000000002')->'dados'),
  (SELECT string_agg(x, ',' ORDER BY x) FROM unnest(ARRAY[pg_temp.v('ok'), pg_temp.v('livre')]) x),
  'o regulador da central, vinculado também à UPA, vê os pedidos da UPA que vão à central dele');
SELECT pg_temp.como('ad000000-0000-4000-8000-000000000006');
SELECT pg_temp.igual(pg_temp.ids(public.regulacao_sla_painel('ad200000-0000-4000-8000-000000000002')->'dados'), '',
  'o regulador só da UPA (não regula a central) vê a lista vazia, sem erro');
SELECT pg_temp.como('ad000000-0000-4000-8000-000000000002');
SELECT pg_temp.igual((public.regulacao_sla_painel('ad200000-0000-4000-8000-000000000002')->'resumo'->>'abertos'), '2',
  'o gestor da origem vê os dois em Esperando decisão');
SELECT pg_temp.como('ad000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.regulacao_sla_painel('ad200000-0000-4000-8000-000000000002')$$, 'Acesso negado',
  'quem não tem papel na UPA não abre o painel dela');

-- ── 5. internados sem laudo de AIH ──────────────────────────────────────────
SELECT pg_temp.como('ad000000-0000-4000-8000-000000000006');
SELECT pg_temp.igual(public.aih_internados_sem_laudo('ad200000-0000-4000-8000-000000000002')::text, '[]',
  'o regulador da unidade abre a lista (vazia: não há internação no teste)');
SELECT pg_temp.como('ad000000-0000-4000-8000-000000000002');
SELECT pg_temp.igual(public.aih_internados_sem_laudo('ad200000-0000-4000-8000-000000000002')::text, '[]', 'o gestor abre');
SELECT pg_temp.como('ad000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.aih_internados_sem_laudo('ad200000-0000-4000-8000-000000000002')$$, 'Acesso negado',
  'o médico não abre');
RESET ROLE;

ROLLBACK;
