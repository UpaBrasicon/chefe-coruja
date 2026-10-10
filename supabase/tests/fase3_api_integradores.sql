-- Fase 3, tarefa 7 — migration 20261104000002_api_integradores.sql: API para
-- integradores. Cobre:
-- - administração das chaves (só o super admin cria; o gestor vê e revoga;
--   a chave aparece uma vez; no banco, só o hash);
-- - a porta única api_v1, só para service_role;
-- - chave inválida, revogada e vencida;
-- - escopo de unidade e de recurso;
-- - IP de origem e limite por minuto;
-- - dados mínimos do paciente;
-- - paginação;
-- - registro de todo acesso.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT '21000000-0000-4000-8000-000000000094', organizacao_id, 'UPA da API', tipo, '7654318', 'Campinas', 'SP'
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000094', '21000000-0000-4000-8000-000000000094', 'PS da API', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000094', 'gestor');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns, cpf, nome_mae, endereco, telefone, municipio_ibge, municipio, uf)
VALUES
  ('23000000-0000-4000-8000-000000000941', '21000000-0000-4000-8000-000000000094', 'Pedro da Api', '1975-01-01', 'P-1',
   '22000000-0000-4000-8000-000000000094', 'M', '798682828807290', '52998224725', 'Mãe do Pedro', 'Rua Secreta 1', '11999990000', '350950', 'Campinas', 'SP'),
  ('23000000-0000-4000-8000-000000000942', '21000000-0000-4000-8000-000000000094', 'Lia Sem Cns', '1990-01-01', 'P-2',
   '22000000-0000-4000-8000-000000000094', 'F', NULL, '11144477735', NULL, NULL, NULL, NULL, NULL, NULL);
-- 1 aberto (o mais recente) e 2 encerrados com alta (só pode haver um aberto por paciente)
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, cor_atual, classificado_em,
                              encerrado_em, desfecho, desfecho_em)
SELECT ('25000000-0000-4000-8000-00000000094' || n)::uuid, '21000000-0000-4000-8000-000000000094',
       '23000000-0000-4000-8000-000000000941', '22000000-0000-4000-8000-000000000094',
       CASE WHEN n = 1 THEN 'atendimento' ELSE 'encerrado' END, 'Dor',
       '10000000-0000-4000-8000-000000000004', now() - make_interval(hours => n), 'verde', now() - make_interval(hours => n),
       CASE WHEN n > 1 THEN now() - make_interval(hours => n) + interval '30 minutes' END,
       CASE WHEN n > 1 THEN 'alta_apos_medicacao' END,
       CASE WHEN n > 1 THEN now() - make_interval(hours => n) + interval '30 minutes' END
  FROM generate_series(1, 3) n;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, service_role;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated, service_role;
CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
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
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, service_role;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated, service_role;
CREATE FUNCTION pg_temp.api(chave text, ip text, recurso text, params jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.api_v1(chave, ip, 'req-teste', recurso, params) $$;
GRANT EXECUTE ON FUNCTION pg_temp.api(text, text, text, jsonb) TO service_role;

SET LOCAL ROLE authenticated;

-- ── 1. administração ────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.api_criar_chave('Secretaria X', 'live', ARRAY['21000000-0000-4000-8000-000000000094']::uuid[], ARRAY['pacientes'])$$,
  'Só a administração da plataforma cria', 'gestor não cria chave');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha($$SELECT public.api_criar_chave('Secretaria X', 'live', ARRAY['21000000-0000-4000-8000-000000000094']::uuid[], ARRAY['pacientes'], ARRAY['não-é-ip'])$$,
  'IP ou faixa inválida', 'IP inválido recusado');
SELECT pg_temp.falha($$SELECT public.api_criar_chave('Secretaria X', 'live', ARRAY['21000000-0000-4000-8000-000000000094']::uuid[], ARRAY['financeiro'])$$,
  'Confira o nome', 'recurso fora da lista recusado');
INSERT INTO t SELECT 'k1', public.api_criar_chave('Secretaria de Saúde de Teste', 'live',
  ARRAY['21000000-0000-4000-8000-000000000094']::uuid[], ARRAY['pacientes', 'atendimentos'], '{}', 3)::text;
INSERT INTO t SELECT 'k2', public.api_criar_chave('Regulação com IP fixo', 'test',
  ARRAY['21000000-0000-4000-8000-000000000094']::uuid[], ARRAY['leitos'], ARRAY['200.10.20.0/24'])::text;
SELECT pg_temp.ok(pg_temp.v('k1')::jsonb->>'chave' LIKE 'cc_live_%' AND length(pg_temp.v('k1')::jsonb->>'chave') = 56,
  'chave cc_live_ com 48 caracteres aleatórios, devolvida uma vez');
SET LOCAL ROLE postgres;
SELECT pg_temp.ok((SELECT hash <> (pg_temp.v('k1')::jsonb->>'chave') AND length(hash) = 64 AND prefixo = left(pg_temp.v('k1')::jsonb->>'chave', 16)
                     FROM public.api_chaves WHERE id = (pg_temp.v('k1')::jsonb->>'id')::uuid),
  'no banco, só o hash SHA-256 e o prefixo');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(public.api_chaves_lista()) x
                    WHERE NOT (x->>'pode_editar')::boolean AND x->'unidades'->0->>'nome' = 'UPA da API') = 2,
  'gestor da unidade vê as chaves que a acessam, sem poder editar');
SELECT pg_temp.falha($$SELECT public.api_ajustar_chave((pg_temp.v('k1')::jsonb->>'id')::uuid, 100, '{}')$$,
  'Só a administração da plataforma ajusta', 'gestor não ajusta limite');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.api_chaves_lista()) x WHERE x->'unidades'->0->>'nome' = 'UPA da API'),
  'quem não é gestor da unidade não vê chave');
SELECT pg_temp.falha($$SELECT public.api_v1(pg_temp.v('k1')::jsonb->>'chave', NULL, 'r', 'unidades', '{}')$$,
  'permission denied', 'usuário logado não chama a porta da API (só a Edge Function)');

-- ── 2. porta da API (como a Edge Function) ──────────────────────────────────
SET LOCAL ROLE service_role;
SELECT pg_temp.ok((pg_temp.api('cc_live_inexistente', '1.2.3.4', 'unidades', '{}')->>'status')::int = 401, 'chave inexistente: 401');
INSERT INTO t SELECT 'r_un', pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'unidades', '{}')::text;
SELECT pg_temp.ok((pg_temp.v('r_un')::jsonb->>'status')::int = 200
               AND pg_temp.v('r_un')::jsonb->'corpo'->'dados'->0->>'cnes' = '7654318'
               AND (pg_temp.v('r_un')::jsonb->'limite'->>'limite')::int = 3,
  'unidades da chave, com o limite nos dados de resposta');
INSERT INTO t SELECT 'r_pac', pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'paciente_busca',
  '{"unidade_id": "21000000-0000-4000-8000-000000000094", "cns": "798682828807290"}')::text;
SELECT pg_temp.ok((SELECT p->>'nome' = 'Pedro da Api' AND p->>'cns' = '798682828807290' AND p->>'cpf' IS NULL
                          AND p->>'municipio_ibge' = '350950' AND NOT p ? 'endereco' AND NOT p ? 'telefone' AND NOT p ? 'nome_mae'
                     FROM (SELECT pg_temp.v('r_pac')::jsonb->'corpo'->'dados'->0 AS p) x),
  'paciente: dados mínimos; CPF não vem quando há CNS; sem endereço, telefone e mãe');
-- limite 3 por minuto: a 4ª consulta da chave no minuto é 429
SELECT pg_temp.ok((pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'paciente', '{"id": "23000000-0000-4000-8000-000000000942"}')->'corpo'->>'cpf') = '11144477735',
  'CPF só para paciente sem CNS');
SELECT pg_temp.ok((pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'unidades', '{}')->>'status')::int = 429, 'acima do limite por minuto: 429');
SET LOCAL ROLE postgres;
UPDATE public.api_chaves SET limite_por_minuto = 60 WHERE id = (pg_temp.v('k1')::jsonb->>'id')::uuid;
SET LOCAL ROLE service_role;
SELECT pg_temp.ok((pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'leitos', '{"unidade_id": "21000000-0000-4000-8000-000000000094"}')->>'status')::int = 403,
  'recurso não liberado na chave: 403');
SELECT pg_temp.ok((pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'atendimentos', '{"unidade_id": "21000000-0000-4000-8000-000000000001", "desde": "2026-01-01T00:00:00Z", "ate": "2026-01-02T00:00:00Z"}')->>'status')::int = 403,
  'unidade fora da chave: 403');
SELECT pg_temp.ok((pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'paciente', '{"id": "23000000-0000-4000-8000-000000000001"}')->>'status')::int = 404,
  'paciente de outra unidade responde como inexistente (404)');
SELECT pg_temp.ok((pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'atendimentos', '{"unidade_id": "21000000-0000-4000-8000-000000000094", "desde": "2026-01-01T00:00:00Z", "ate": "2026-03-01T00:00:00Z"}')->>'status')::int = 400,
  'período acima de 31 dias: 400');
-- paginação: 3 atendimentos, 2 por página
INSERT INTO t SELECT 'p1', pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'atendimentos',
  jsonb_build_object('unidade_id', '21000000-0000-4000-8000-000000000094', 'desde', now() - interval '1 day', 'ate', now() + interval '1 minute', 'limite', 2))::text;
INSERT INTO t SELECT 'p2', pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'atendimentos',
  jsonb_build_object('unidade_id', '21000000-0000-4000-8000-000000000094', 'desde', now() - interval '1 day', 'ate', now() + interval '1 minute', 'limite', 2,
                     'cursor', pg_temp.v('p1')::jsonb->'corpo'->>'proximo_cursor'))::text;
SELECT pg_temp.ok(jsonb_array_length(pg_temp.v('p1')::jsonb->'corpo'->'dados') = 2 AND pg_temp.v('p1')::jsonb->'corpo'->>'proximo_cursor' IS NOT NULL
               AND jsonb_array_length(pg_temp.v('p2')::jsonb->'corpo'->'dados') = 1 AND pg_temp.v('p2')::jsonb->'corpo'->>'proximo_cursor' IS NULL
               AND pg_temp.v('p1')::jsonb->'corpo'->'dados'->0->'classificacao'->>'cor' = 'verde'
               AND pg_temp.v('p1')::jsonb->'corpo'->'dados'->0->>'situacao' = 'encerrado'
               AND pg_temp.v('p1')::jsonb->'corpo'->'dados'->0->>'desfecho' = 'alta'
               AND pg_temp.v('p2')::jsonb->'corpo'->'dados'->0->>'situacao' = 'aguardando_medico',
  'atendimentos paginados por cursor, com classificação, situação e desfecho no vocabulário da API');
SELECT pg_temp.ok((pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'atendimentos', '{"unidade_id": "21000000-0000-4000-8000-000000000094", "desde": "x", "ate": "y"}')->>'status')::int = 400,
  'data fora do formato: 400');
-- IP fixo
SELECT pg_temp.ok((pg_temp.api(pg_temp.v('k2')::jsonb->>'chave', '9.9.9.9', 'leitos', '{"unidade_id": "21000000-0000-4000-8000-000000000094"}')->>'status')::int = 403
               AND (pg_temp.api(pg_temp.v('k2')::jsonb->>'chave', '200.10.20.77', 'leitos', '{"unidade_id": "21000000-0000-4000-8000-000000000094"}')->>'status')::int = 200,
  'IP fora da faixa: 403; dentro: 200');

-- ── 3. revogação, vencimento e registro ─────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.api_revogar_chave((pg_temp.v('k2')::jsonb->>'id')::uuid, 'curto')$$, 'Escreva o motivo', 'revogar pede motivo');
SELECT public.api_revogar_chave((pg_temp.v('k2')::jsonb->>'id')::uuid, 'Integração encerrada pela regulação');
SET LOCAL ROLE service_role;
SELECT pg_temp.ok((pg_temp.api(pg_temp.v('k2')::jsonb->>'chave', '200.10.20.77', 'leitos', '{"unidade_id": "21000000-0000-4000-8000-000000000094"}')->>'status')::int = 401,
  'chave revogada pelo gestor: 401 na hora');
SET LOCAL ROLE postgres;
UPDATE public.api_chaves SET criada_em = now() - interval '13 months', expira_em = now() - interval '1 second' WHERE id = (pg_temp.v('k1')::jsonb->>'id')::uuid;
SET LOCAL ROLE service_role;
SELECT pg_temp.ok((pg_temp.api(pg_temp.v('k1')::jsonb->>'chave', '1.2.3.4', 'unidades', '{}')->>'detalhe') = 'A chave venceu.', 'chave vencida: 401');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(public.api_acessos_da_chave((pg_temp.v('k1')::jsonb->>'id')::uuid))) >= 10
               AND EXISTS (SELECT 1 FROM jsonb_array_elements(public.api_acessos_da_chave((pg_temp.v('k1')::jsonb->>'id')::uuid)) a
                            WHERE (a->>'status')::int = 429 AND a->>'ip' = '1.2.3.4' AND a->>'requisicao' = 'req-teste'),
  'toda consulta fica registrada (recurso, status, IP, requisição)');

ROLLBACK;
