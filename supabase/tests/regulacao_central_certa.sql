-- Testes da migration 20270421000012 (o pedido vai à central certa; prazo por
-- tipo no relógio da fila; capacidades das unidades reguladas). Dados
-- próprios, sem o seed. ROLLBACK no fim.
-- Cobre:
-- - o pedido vai à central que regula a unidade; sem vínculo, à principal;
--   tirado o vínculo, o pedido novo vai à principal e o antigo fica onde entrou;
-- - o regulador de cada central vê a fila, os recebidos e o painel dela e não
--   os da outra; não assume pedido da outra; ajusta prazos e critérios da
--   central dele (não só a principal); mapa de vagas e indicadores abrem;
-- - prazo por tipo vale no relógio da fila (prazo_por = tipo) e ganha do prazo
--   por prioridade; sem prazo por tipo, continua o por prioridade;
-- - capacidades: o regulador e o gestor da central veem as unidades que ela
--   regula (a principal, as sem vínculo; sem as centrais); médico, regulador
--   de outra central e de outra rede não veem; o anônimo não chama.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303060190', 'TRATAMENTO DE IAM DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;

INSERT INTO auth.users (id, email)
SELECT ('ac000000-0000-4000-8000-00000000000' || n)::uuid, 'centralcerta' || n || '@centrais.local' FROM generate_series(1, 7) n
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('ac000000-0000-4000-8000-000000000001', 'Médico UPA Sul'),
  ('ac000000-0000-4000-8000-000000000002', 'Médico UPA Leste'),
  ('ac000000-0000-4000-8000-000000000003', 'Regulador Sul'),
  ('ac000000-0000-4000-8000-000000000004', 'Regulador Principal'),
  ('ac000000-0000-4000-8000-000000000005', 'Gestor Central Sul'),
  ('ac000000-0000-4000-8000-000000000006', 'Regulador de Fora'),
  ('ac000000-0000-4000-8000-000000000007', 'Gestor UPA Sul')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES
  ('ac100000-0000-4000-8000-000000000001', 'Rede Central Certa'),
  ('ac100000-0000-4000-8000-000000000002', 'Rede de Fora');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  ('ac200000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001', 'Central Principal', 'clinica', NULL),
  ('ac200000-0000-4000-8000-000000000002', 'ac100000-0000-4000-8000-000000000001', 'Central Sul', 'clinica', NULL),
  ('ac200000-0000-4000-8000-000000000003', 'ac100000-0000-4000-8000-000000000001', 'UPA Sul', 'upa', '7654321'),
  ('ac200000-0000-4000-8000-000000000004', 'ac100000-0000-4000-8000-000000000001', 'UPA Leste', 'upa', '7654322'),
  ('ac200000-0000-4000-8000-000000000005', 'ac100000-0000-4000-8000-000000000001', 'Hospital Sul', 'hospital', '7654323'),
  ('ac200000-0000-4000-8000-000000000006', 'ac100000-0000-4000-8000-000000000002', 'Central de Fora', 'clinica', NULL);
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('ac000000-0000-4000-8000-000000000001', 'ac200000-0000-4000-8000-000000000003', 'plantonista'),
  ('ac000000-0000-4000-8000-000000000002', 'ac200000-0000-4000-8000-000000000004', 'plantonista'),
  ('ac000000-0000-4000-8000-000000000003', 'ac200000-0000-4000-8000-000000000002', 'regulador'),
  ('ac000000-0000-4000-8000-000000000004', 'ac200000-0000-4000-8000-000000000001', 'regulador'),
  ('ac000000-0000-4000-8000-000000000005', 'ac200000-0000-4000-8000-000000000002', 'gestor'),
  ('ac000000-0000-4000-8000-000000000006', 'ac200000-0000-4000-8000-000000000006', 'regulador'),
  ('ac000000-0000-4000-8000-000000000007', 'ac200000-0000-4000-8000-000000000003', 'gestor');
-- principal de cada rede (o gatilho põe no cadastro); a Sul é outra central
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por) VALUES
  ('ac100000-0000-4000-8000-000000000001', 'ac200000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000004'),
  ('ac100000-0000-4000-8000-000000000002', 'ac200000-0000-4000-8000-000000000006', 'ac000000-0000-4000-8000-000000000006');
INSERT INTO public.regulacao_centrais_cadastro (unidade_id, organizacao_id, criada_por) VALUES
  ('ac200000-0000-4000-8000-000000000002', 'ac100000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000004');
-- a Sul regula a UPA Sul e o Hospital Sul; a UPA Leste fica sem vínculo
INSERT INTO public.regulacao_central_unidades (unidade_id, central_id, definida_por) VALUES
  ('ac200000-0000-4000-8000-000000000003', 'ac200000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000004'),
  ('ac200000-0000-4000-8000-000000000005', 'ac200000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000004');
-- a Sul tem prazo para leito (2 h); a principal, nenhum por tipo
INSERT INTO public.regulacao_prazos_tipo (central_id, tipo, prazo_min, atualizado_por) VALUES
  ('ac200000-0000-4000-8000-000000000002', 'leito', 120, 'ac000000-0000-4000-8000-000000000004');
INSERT INTO public.regulacao_unidade_capacidades (unidade_id, categoria, codigo, nome, quantidade, atualizado_por) VALUES
  ('ac200000-0000-4000-8000-000000000005', 'leito', 'uti_adulto', 'UTI adulto', 10, 'ac000000-0000-4000-8000-000000000004'),
  ('ac200000-0000-4000-8000-000000000005', 'exame', 'tomografia', 'Tomografia', NULL, 'ac000000-0000-4000-8000-000000000004'),
  ('ac200000-0000-4000-8000-000000000004', 'especialidade', 'cardiologia', 'Cardiologia', NULL, 'ac000000-0000-4000-8000-000000000004');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo) VALUES
  ('ac300000-0000-4000-8000-000000000001', 'ac200000-0000-4000-8000-000000000003', 'Paciente da UPA Sul', '1970-01-01', 'CC-1', 'M'),
  ('ac300000-0000-4000-8000-000000000002', 'ac200000-0000-4000-8000-000000000004', 'Paciente da UPA Leste', '1965-05-05', 'CC-2', 'F');

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
-- os ids dos pedidos de uma lista JSON, em ordem
CREATE FUNCTION pg_temp.ids(p jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(e->>'id', ',' ORDER BY e->>'id'), '') FROM jsonb_array_elements(p) e $$;
CREATE FUNCTION pg_temp.pedido(p jsonb, p_id text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT e FROM jsonb_array_elements(p) e WHERE e->>'id' = p_id $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.como(text), pg_temp.falha(text, text, text), pg_temp.igual(text, text, text),
  pg_temp.ids(jsonb), pg_temp.pedido(jsonb, text) TO authenticated, anon;

-- ── 1. cada pedido vai à sua central ────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('ac000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'sul', r->>'id' FROM (SELECT public.regulacao_solicitar('ac200000-0000-4000-8000-000000000003',
  'ac300000-0000-4000-8000-000000000001', '{"tipo":"leito","tipo_leito":"uti_adulto","procedimento":"0303060190","carater":"urgencia","prioridade":"urgencia","cid":"I21.9","destino_tipo":"a_definir","paciente_nao_identificado":true,"quadro_clinico":"Dor torácica há duas horas, supra de ST em parede inferior."}') r) x;
SELECT pg_temp.igual((public.regulacao_contexto('ac200000-0000-4000-8000-000000000003')->'central'->>'nome'), 'Central Sul',
  'a UPA Sul vê que os pedidos dela vão à Central Sul');
SELECT pg_temp.igual((public.regulacao_prazos('ac200000-0000-4000-8000-000000000003')->'por_tipo'->>'leito'), '120',
  'a origem vê os prazos da central dela, com o prazo por tipo');
SELECT pg_temp.como('ac000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'leste', r->>'id' FROM (SELECT public.regulacao_solicitar('ac200000-0000-4000-8000-000000000004',
  'ac300000-0000-4000-8000-000000000002', '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303060190","carater":"urgencia","prioridade":"urgencia","cid":"I21.9","destino_tipo":"a_definir","paciente_nao_identificado":true,"quadro_clinico":"Dor torácica atípica, troponina em curva, sem supra de ST."}') r) x;
RESET ROLE;
SELECT pg_temp.igual((SELECT string_agg(u.nome, ',' ORDER BY s.numero) FROM public.regulacao_solicitacoes s JOIN public.unidades u ON u.id = s.central_id
                       WHERE s.id IN (pg_temp.v('sul')::uuid, pg_temp.v('leste')::uuid)),
  'Central Sul,Central Principal', 'UPA Sul → Central Sul; UPA Leste, sem vínculo → principal');
SET LOCAL ROLE authenticated;

-- ── 2. o regulador da Central Sul vê só os pedidos dela ─────────────────────
SELECT pg_temp.como('ac000000-0000-4000-8000-000000000003');
SELECT pg_temp.igual((SELECT (x->>'sou_central') || ':' || (x->>'sou_regulador') || ':' || (x->'central'->>'nome')
                        FROM public.regulacao_contexto('ac200000-0000-4000-8000-000000000002') x),
  'true:true:Central Sul', 'a Central Sul é central e o regulador dela regula');
SELECT pg_temp.igual(pg_temp.ids(public.regulacao_fila('ac200000-0000-4000-8000-000000000002')->'dados'), pg_temp.v('sul'),
  'a fila da Central Sul tem só o pedido da UPA Sul');
SELECT pg_temp.igual(pg_temp.ids(public.regulacao_lista('ac200000-0000-4000-8000-000000000002')), pg_temp.v('sul'),
  'os recebidos da Central Sul');
SELECT pg_temp.falha($$SELECT public.regulacao_fila('ac200000-0000-4000-8000-000000000001')$$, 'Acesso negado',
  'o regulador da Sul não abre a fila da principal');
SELECT pg_temp.falha(format('SELECT public.regulacao_assumir(%L)', pg_temp.v('leste')), 'Assume o pedido',
  'o regulador da Sul não assume pedido da principal');
SELECT public.regulacao_assumir(pg_temp.v('sul')::uuid);

-- prazo por tipo no painel: leito na Sul = 120 min, mesmo com prazo por prioridade
SELECT public.regulacao_definir_prazos('ac200000-0000-4000-8000-000000000002', '{"fila": {"urgencia": 30}}');
SELECT pg_temp.igual((SELECT (p->'sla'->'fila'->>'prazo_min') || ':' || (p->'sla'->'fila'->>'prazo_por')
                        FROM pg_temp.pedido(public.regulacao_sla_painel('ac200000-0000-4000-8000-000000000002')->'dados', pg_temp.v('sul')) p),
  '120:tipo', 'o painel usa o prazo da central para o tipo do pedido');
SELECT pg_temp.igual((SELECT (x->'prazos'->'por_tipo'->>'leito') || ':' || (x->'prazos'->'fila'->>'urgencia') || ':' || (x->'resumo'->>'fila_prazo_tipo')
                        FROM public.regulacao_sla_painel('ac200000-0000-4000-8000-000000000002') x),
  '120:30:1', 'o painel traz os prazos por tipo e por prioridade da Central Sul');
SELECT public.regulacao_definir_criterio('ac200000-0000-4000-8000-000000000002', 'urgencia', 'Critério da Central Sul para urgência.');
SELECT pg_temp.igual((SELECT count(*)::text FROM jsonb_object_keys(public.regulacao_criterios('ac200000-0000-4000-8000-000000000002'))),
  '1', 'a Central Sul escreve os próprios critérios');
SELECT pg_temp.igual((public.regulacao_mapa_vagas('ac200000-0000-4000-8000-000000000002')->>'so_consulta'), 'false',
  'o regulador da Sul abre o mapa de vagas');
SELECT pg_temp.igual((public.regulacao_indicadores('ac200000-0000-4000-8000-000000000002')->>'escopo'), 'unidades',
  'indicadores da Central Sul: as unidades que ela regula');
SELECT pg_temp.igual((SELECT string_agg(u->>'nome' || '=' || jsonb_array_length(u->'capacidades'), ', ' ORDER BY u->>'nome')
                        FROM jsonb_array_elements(public.regulacao_capacidades_reguladas('ac200000-0000-4000-8000-000000000002')->'unidades') u),
  'Hospital Sul=2, UPA Sul=0', 'o regulador da Sul vê o que as unidades dela têm');
SELECT pg_temp.falha($$SELECT public.regulacao_capacidades_reguladas('ac200000-0000-4000-8000-000000000001')$$, 'Acesso negado',
  'o regulador da Sul não vê as unidades da principal');

-- ── 3. a principal: os sem vínculo, prazo por prioridade ────────────────────
SELECT pg_temp.como('ac000000-0000-4000-8000-000000000004');
SELECT pg_temp.igual(pg_temp.ids(public.regulacao_fila('ac200000-0000-4000-8000-000000000001')->'dados'), pg_temp.v('leste'),
  'a fila da principal tem só o pedido da UPA Leste');
SELECT pg_temp.falha($$SELECT public.regulacao_fila('ac200000-0000-4000-8000-000000000002')$$, 'Acesso negado',
  'o regulador da principal não abre a fila da Sul');
SELECT public.regulacao_definir_prazos('ac200000-0000-4000-8000-000000000001', '{"fila": {"urgencia": 45}}');
SELECT pg_temp.igual((SELECT (p->'sla'->'fila'->>'prazo_min') || ':' || (p->'sla'->'fila'->>'prazo_por')
                        FROM pg_temp.pedido(public.regulacao_sla_painel('ac200000-0000-4000-8000-000000000001')->'dados', pg_temp.v('leste')) p),
  '45:prioridade', 'sem prazo por tipo, continua o prazo por prioridade');
SELECT pg_temp.igual((public.regulacao_indicadores('ac200000-0000-4000-8000-000000000001')->>'escopo'), 'rede',
  'indicadores da principal: a rede');
SELECT pg_temp.igual((SELECT string_agg(u->>'nome' || '=' || jsonb_array_length(u->'capacidades'), ', ' ORDER BY u->>'nome')
                        FROM jsonb_array_elements(public.regulacao_capacidades_reguladas('ac200000-0000-4000-8000-000000000001')->'unidades') u),
  'UPA Leste=1', 'a principal vê só as unidades sem vínculo (sem as centrais e sem as da Sul)');

-- ── 4. quem mais vê as capacidades ──────────────────────────────────────────
SELECT pg_temp.como('ac000000-0000-4000-8000-000000000005');
SELECT pg_temp.igual(jsonb_array_length(public.regulacao_capacidades_reguladas('ac200000-0000-4000-8000-000000000002')->'unidades')::text, '2',
  'o gestor da Central Sul vê as capacidades');
SELECT pg_temp.como('ac000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.regulacao_capacidades_reguladas('ac200000-0000-4000-8000-000000000002')$$, 'Acesso negado',
  'o médico da UPA não vê as capacidades');
SELECT pg_temp.falha($$SELECT public.regulacao_capacidades_reguladas('ac200000-0000-4000-8000-000000000003')$$, 'Esta unidade não é uma central',
  'unidade que não é central é recusada');
SELECT pg_temp.falha($$SELECT public.regulacao_fila('ac200000-0000-4000-8000-000000000002')$$, 'Acesso negado',
  'o médico da UPA não abre a fila da central');
SELECT pg_temp.como('ac000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.regulacao_capacidades_reguladas('ac200000-0000-4000-8000-000000000002')$$, 'Acesso negado',
  'o regulador de outra rede não vê as capacidades');
SELECT pg_temp.falha($$SELECT public.regulacao_lista('ac200000-0000-4000-8000-000000000002')$$, 'Acesso negado',
  'o regulador de outra rede não vê os recebidos da Sul');

-- ── 5. sem vínculo, o pedido novo vai à principal; o antigo fica ────────────
RESET ROLE;
DELETE FROM public.regulacao_central_unidades WHERE unidade_id = 'ac200000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('ac000000-0000-4000-8000-000000000007');
INSERT INTO t SELECT 'sul2', r->>'id' FROM (SELECT public.regulacao_solicitar('ac200000-0000-4000-8000-000000000003',
  'ac300000-0000-4000-8000-000000000001', '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303060190","carater":"urgencia","prioridade":"urgencia","cid":"I21.9","destino_tipo":"a_definir","paciente_nao_identificado":true,"quadro_clinico":"Pedido aberto pelo gestor depois que a UPA saiu da Central Sul."}') r) x;
RESET ROLE;
SELECT pg_temp.igual((SELECT string_agg(u.nome, ',' ORDER BY s.numero) FROM public.regulacao_solicitacoes s JOIN public.unidades u ON u.id = s.central_id
                       WHERE s.id IN (pg_temp.v('sul')::uuid, pg_temp.v('sul2')::uuid)),
  'Central Sul,Central Principal', 'sem vínculo o pedido novo vai à principal; o antigo fica na Sul');

SET LOCAL ROLE anon;
SELECT pg_temp.falha($$SELECT public.regulacao_capacidades_reguladas('ac200000-0000-4000-8000-000000000002')$$, 'permission denied',
  'anônimo não chama');
RESET ROLE;

ROLLBACK;
