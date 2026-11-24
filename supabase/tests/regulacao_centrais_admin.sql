-- Testes da migration 20270421000010 (regulamentação das centrais pelo
-- administrador, pedido do RT de 24/11/2026). Dados próprios. ROLLBACK no fim.
-- O administrador da organização cadastra as centrais (a primeira passa a
-- receber os pedidos), define as unidades reguladas, o que cada unidade tem e
-- o prazo por tipo de pedido, e lê tudo; o gestor e o médico não gravam nem
-- leem; o administrador de outra organização não vê nem mexe; as tabelas não
-- se leem nem se escrevem direto; o anônimo não chama.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO auth.users (id, email)
SELECT ('ab000000-0000-4000-8000-00000000000' || n)::uuid, 'regcentral' || n || '@centrais.local' FROM generate_series(1, 4) n
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('ab000000-0000-4000-8000-000000000001', 'Admin Centrais'),
  ('ab000000-0000-4000-8000-000000000002', 'Gestora Centrais'),
  ('ab000000-0000-4000-8000-000000000003', 'Médico Centrais'),
  ('ab000000-0000-4000-8000-000000000004', 'Admin Outra Rede')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES
  ('ab100000-0000-4000-8000-000000000001', 'Rede Centrais'),
  ('ab100000-0000-4000-8000-000000000002', 'Rede Vizinha');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('ab200000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001', 'Regulação Centro-Sul', 'clinica'),
  ('ab200000-0000-4000-8000-000000000002', 'ab100000-0000-4000-8000-000000000001', 'Regulação Norte', 'clinica'),
  ('ab200000-0000-4000-8000-000000000003', 'ab100000-0000-4000-8000-000000000001', 'Hospital Centrais', 'hospital'),
  ('ab200000-0000-4000-8000-000000000004', 'ab100000-0000-4000-8000-000000000001', 'UPA Centrais', 'upa'),
  ('ab200000-0000-4000-8000-000000000005', 'ab100000-0000-4000-8000-000000000002', 'UPA Vizinha', 'upa');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('ab000000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000003', 'admin'),
  ('ab000000-0000-4000-8000-000000000002', 'ab200000-0000-4000-8000-000000000003', 'gestor'),
  ('ab000000-0000-4000-8000-000000000003', 'ab200000-0000-4000-8000-000000000004', 'plantonista'),
  ('ab000000-0000-4000-8000-000000000004', 'ab200000-0000-4000-8000-000000000005', 'admin');

CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.igual(p_obtido text, p_esperado text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtido IS DISTINCT FROM p_esperado THEN
    RAISE EXCEPTION 'FALHOU: % — esperado %, veio %', p_ok, p_esperado, p_obtido;
  END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.igual(text, text, text) TO authenticated;
-- a organização de teste, no JSON da leitura
CREATE FUNCTION pg_temp.org(p jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT e FROM jsonb_array_elements(p) e WHERE e->>'organizacao_id' = 'ab100000-0000-4000-8000-000000000001' $$;
GRANT EXECUTE ON FUNCTION pg_temp.org(jsonb) TO authenticated;

-- ── o administrador grava ───────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('ab000000-0000-4000-8000-000000000001');
SELECT public.regulacao_cadastrar_central('ab200000-0000-4000-8000-000000000001');
SELECT public.regulacao_cadastrar_central('ab200000-0000-4000-8000-000000000002');
SELECT pg_temp.igual(pg_temp.org(public.regulacao_regulamentacao())->>'principal', 'ab200000-0000-4000-8000-000000000001',
  'a primeira central da rede passa a receber os pedidos');
SELECT pg_temp.igual(jsonb_array_length(pg_temp.org(public.regulacao_regulamentacao())->'centrais')::text, '2',
  'as duas centrais aparecem na leitura');

SELECT pg_temp.igual(public.regulacao_definir_unidades_central('ab200000-0000-4000-8000-000000000001',
  ARRAY['ab200000-0000-4000-8000-000000000003', 'ab200000-0000-4000-8000-000000000004']::uuid[])->>'incluidas', '2',
  'a Centro-Sul passa a regular o hospital e a UPA');
SELECT pg_temp.igual(public.regulacao_definir_unidades_central('ab200000-0000-4000-8000-000000000002',
  ARRAY['ab200000-0000-4000-8000-000000000004']::uuid[])->>'movidas', '1',
  'a UPA passa para a central Norte');
SELECT pg_temp.igual((SELECT string_agg(e->>'nome' || '=' || coalesce(e->>'central_id', '-'), ', ' ORDER BY e->>'nome')
                        FROM jsonb_array_elements(pg_temp.org(public.regulacao_regulamentacao())->'unidades') e
                       WHERE NOT (e->>'eh_central')::boolean),
  'Hospital Centrais=ab200000-0000-4000-8000-000000000001, UPA Centrais=ab200000-0000-4000-8000-000000000002',
  'cada unidade com a sua central');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_unidades_central('ab200000-0000-4000-8000-000000000001',
  ARRAY['ab200000-0000-4000-8000-000000000002']::uuid[])$$, 'Central não é regulada', 'central não regula outra central');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_unidades_central('ab200000-0000-4000-8000-000000000001',
  ARRAY['ab200000-0000-4000-8000-000000000005']::uuid[])$$, 'Fora da rede', 'unidade de outra organização é recusada');
SELECT pg_temp.falha($$SELECT public.regulacao_cadastrar_central('ab200000-0000-4000-8000-000000000003')$$,
  'Esta unidade é regulada', 'unidade regulada não vira central sem sair da outra');

SELECT pg_temp.igual(public.regulacao_salvar_capacidades('ab200000-0000-4000-8000-000000000003', $j$[
  {"categoria": "leito", "codigo": "uti_adulto", "nome": "UTI adulto", "quantidade": 10},
  {"categoria": "leito", "codigo": "clinico", "nome": "Clínico", "quantidade": 40},
  {"categoria": "exame", "codigo": "tomografia", "nome": "Tomografia"},
  {"categoria": "especialidade", "codigo": "ortopedia_e_traumatologia", "nome": "Ortopedia e traumatologia"}]$j$)::text, '4',
  'grava o que o hospital tem');
SELECT public.regulacao_salvar_capacidades('ab200000-0000-4000-8000-000000000003', $j$[
  {"categoria": "leito", "codigo": "uti_adulto", "nome": "UTI adulto", "quantidade": 12},
  {"categoria": "exame", "codigo": "tomografia", "nome": "Tomografia", "observacao": "só de dia"}]$j$);
SELECT pg_temp.igual((SELECT string_agg(e->>'codigo' || ':' || coalesce(e->>'quantidade', '-') || ':' || coalesce(e->>'observacao', '-'), ', ' ORDER BY e->>'codigo')
                        FROM jsonb_array_elements(pg_temp.org(public.regulacao_regulamentacao())->'unidades') u,
                             jsonb_array_elements(u->'capacidades') e
                       WHERE u->>'id' = 'ab200000-0000-4000-8000-000000000003'),
  'tomografia:-:só de dia, uti_adulto:12:-', 'a lista nova troca a antiga (o que saiu a unidade não tem)');
SELECT pg_temp.falha($$SELECT public.regulacao_salvar_capacidades('ab200000-0000-4000-8000-000000000003',
  '[{"categoria": "leito", "codigo": "uti_marciana", "nome": "UTI marciana"}]')$$, 'Tipo de leito fora da lista', 'tipo de leito fora da lista');
SELECT pg_temp.falha($$SELECT public.regulacao_salvar_capacidades('ab200000-0000-4000-8000-000000000003',
  '[{"categoria": "exame", "codigo": "raio_x", "nome": "Raio-X"}, {"categoria": "exame", "codigo": "raio_x", "nome": "Raio-X"}]')$$,
  'Item repetido', 'item repetido é recusado');
SELECT pg_temp.falha($$SELECT public.regulacao_salvar_capacidades('ab200000-0000-4000-8000-000000000003',
  '[{"categoria": "leito", "codigo": "clinico", "nome": "Clínico", "quantidade": -1}]')$$, 'Quantidade de leitos', 'quantidade negativa');

SELECT pg_temp.igual(public.regulacao_definir_prazos_tipo('ab200000-0000-4000-8000-000000000001',
  '{"leito": 120, "consulta": 43200, "exame": 10080}')::text, '{"exame": 10080, "leito": 120, "consulta": 43200}',
  'prazo por tipo de pedido');
SELECT public.regulacao_definir_prazos_tipo('ab200000-0000-4000-8000-000000000001', '{"exame": null}');
SELECT pg_temp.igual((pg_temp.org(public.regulacao_regulamentacao())->'centrais'->0->'prazos')::text,
  '{"leito": 120, "consulta": 43200}', 'prazo vazio sai');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_prazos_tipo('ab200000-0000-4000-8000-000000000001', '{"cirurgia": 10}')$$,
  'Tipo de pedido fora da lista', 'tipo fora da lista');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_prazos_tipo('ab200000-0000-4000-8000-000000000001', '{"leito": 0}')$$,
  'Prazo de 1 minuto', 'prazo zero');

SELECT pg_temp.falha($$SELECT public.regulacao_retirar_central('ab200000-0000-4000-8000-000000000001')$$,
  'Esta central recebe os pedidos', 'a central que recebe os pedidos não sai');
SELECT public.regulacao_retirar_central('ab200000-0000-4000-8000-000000000002');
SELECT pg_temp.igual((SELECT e->>'central_id' FROM jsonb_array_elements(pg_temp.org(public.regulacao_regulamentacao())->'unidades') e
                       WHERE e->>'id' = 'ab200000-0000-4000-8000-000000000004'), NULL, 'retirada a central, a UPA fica sem central');
SELECT pg_temp.igual(jsonb_array_length(pg_temp.org(public.regulacao_regulamentacao())->'centrais')::text, '1', 'a central retirada sai da lista');

-- ── as tabelas não se leem nem se escrevem direto ───────────────────────────
SELECT pg_temp.falha($$SELECT count(*) FROM public.regulacao_unidade_capacidades$$, 'permission denied', 'não lê a tabela direto');
SELECT pg_temp.falha($$INSERT INTO public.regulacao_prazos_tipo (central_id, tipo, prazo_min, atualizado_por)
  VALUES ('ab200000-0000-4000-8000-000000000001', 'leito', 5, 'ab000000-0000-4000-8000-000000000001')$$,
  'permission denied', 'não escreve na tabela direto');

-- ── gestor e médico não gravam nem leem ─────────────────────────────────────
SELECT pg_temp.como('ab000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_regulamentacao()$$, 'Quem regulamenta', 'o gestor não lê a regulamentação');
SELECT pg_temp.falha($$SELECT public.regulacao_cadastrar_central('ab200000-0000-4000-8000-000000000004')$$, 'Quem regulamenta', 'o gestor não cadastra central');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_unidades_central('ab200000-0000-4000-8000-000000000001', '{}')$$,
  'Quem regulamenta', 'o gestor não muda as unidades reguladas');
SELECT pg_temp.falha($$SELECT public.regulacao_salvar_capacidades('ab200000-0000-4000-8000-000000000003', '[]')$$,
  'Quem regulamenta', 'o gestor não muda o que a unidade tem');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_prazos_tipo('ab200000-0000-4000-8000-000000000001', '{"leito": 60}')$$,
  'Quem regulamenta', 'o gestor não muda os prazos');
SELECT pg_temp.como('ab000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha($$SELECT public.regulacao_regulamentacao()$$, 'Quem regulamenta', 'o médico não lê a regulamentação');
SELECT pg_temp.falha($$SELECT public.regulacao_salvar_capacidades('ab200000-0000-4000-8000-000000000004', '[]')$$,
  'Quem regulamenta', 'o médico não muda o que a unidade tem');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_prazos_tipo('ab200000-0000-4000-8000-000000000001', '{"leito": 60}')$$,
  'Quem regulamenta', 'o médico não muda os prazos');

-- ── o administrador de outra organização não vê nem mexe ────────────────────
SELECT pg_temp.como('ab000000-0000-4000-8000-000000000004');
SELECT pg_temp.igual((pg_temp.org(public.regulacao_regulamentacao()) IS NULL)::text, 'true', 'não vê a rede dos outros');
SELECT pg_temp.falha($$SELECT public.regulacao_retirar_central('ab200000-0000-4000-8000-000000000001')$$, 'Quem regulamenta', 'não retira central dos outros');
SELECT pg_temp.falha($$SELECT public.regulacao_salvar_capacidades('ab200000-0000-4000-8000-000000000003', '[]')$$,
  'Quem regulamenta', 'não muda unidade dos outros');

-- ── histórico e auditoria ───────────────────────────────────────────────────
RESET ROLE;
SELECT pg_temp.igual((SELECT count(*)::text FROM public.regulacao_prazos_historico
                       WHERE central_id = 'ab200000-0000-4000-8000-000000000001' AND depois ? 'por_tipo'), '2',
  'cada ajuste de prazo fica no histórico, com o antes e o depois');
SELECT pg_temp.igual((SELECT count(DISTINCT acao)::text FROM public.log_auditoria
                       WHERE ator_id = 'ab000000-0000-4000-8000-000000000001' AND acao LIKE 'regulacao_%'), '6',
  'cada mudança fica na auditoria');

-- ── a central apontada pelo super admin entra no cadastro ───────────────────
UPDATE public.centrais_regulacao SET unidade_id = 'ab200000-0000-4000-8000-000000000003'
 WHERE organizacao_id = 'ab100000-0000-4000-8000-000000000001';
SELECT pg_temp.igual((SELECT ativa::text FROM public.regulacao_centrais_cadastro WHERE unidade_id = 'ab200000-0000-4000-8000-000000000003')
  || ':' || (SELECT count(*) FROM public.regulacao_central_unidades WHERE unidade_id = 'ab200000-0000-4000-8000-000000000003')::text,
  'true:0', 'a nova principal entra no cadastro e deixa de ser regulada');

SET LOCAL ROLE anon;
SELECT pg_temp.falha($$SELECT public.regulacao_regulamentacao()$$, 'permission denied', 'anônimo não chama');
RESET ROLE;

ROLLBACK;
