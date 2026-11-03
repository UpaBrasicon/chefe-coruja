-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270215000001_ciap2.sql (5A, tarefa 4, parte 4.1). Tudo
-- em transação com ROLLBACK. O cenário é criado aqui, sem depender do seed.
--
-- 1. a tabela do LEDI: 686 códigos, alguns conferidos com a CID relacionada;
-- 2. a busca terminologia_buscar('ciap2') por nome e por código;
-- 3. a conduta aceita só a CIAP-2 como problema; recusa código fora da
--    tabela; quem chama sem a CIAP continua igual; a assinatura antiga saiu.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000057a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000057a2'),
  ('cons', '00000000-0000-4000-8000-0000000057a3'),
  ('rec',  '00000000-0000-4000-8000-0000000057a4'),
  ('med',  '00000000-0000-4000-8000-0000000057a5');
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
CREATE TEMP TABLE epi (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON epi TO authenticated;
CREATE FUNCTION pg_temp.e(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM epi WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.e(text) TO authenticated;

-- ── 1. tabela ───────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) = 686 FROM terminologia.ciap2), 'tabela do LEDI com 686 códigos');
SELECT pg_temp.ok((SELECT descricao = 'FEBRE' AND cid10_relacionada = 'R50' AND capitulo = 'A' FROM terminologia.ciap2 WHERE codigo = 'A03'), 'A03 febre, CID R50');
SELECT pg_temp.ok((SELECT cid10_relacionada = 'I10' FROM terminologia.ciap2 WHERE codigo = 'K86'), 'K86 hipertensão sem complicações, CID I10');
SELECT pg_temp.ok((SELECT cid10_relacionada = 'R68.8' FROM terminologia.ciap2 WHERE codigo = 'A02'), 'CID relacionada no formato do app (com ponto)');

-- ── fixture ─────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) SELECT id, nome || '@5a4.local' FROM ids WHERE nome IN ('rec', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do 5A4');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do 5A4', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'med']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── 2. busca ────────────────────────────────────────────────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.ok((SELECT bool_or(codigo = 'A03') FROM public.terminologia_buscar('ciap2', 'febre', 10)), 'busca por nome (febre)');
SELECT pg_temp.ok((SELECT codigo = 'K86' FROM public.terminologia_buscar('ciap2', 'K86', 5) LIMIT 1), 'busca pelo código vem primeiro');
SELECT pg_temp.ok((SELECT extra ->> 'cid10' = 'I10' FROM public.terminologia_buscar('ciap2', 'K86', 1)), 'a busca traz a CID relacionada');

-- ── 3. conduta ──────────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO epi SELECT 'um', (public.registrar_ficha(pg_temp.id('cons'), 'Pressão alta', NULL,
  '{"nome":"Paciente CIAP Um","data_nascimento":"1960-01-01","tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;
INSERT INTO epi SELECT 'dois', (public.registrar_ficha(pg_temp.id('cons'), 'Tosse', NULL,
  '{"nome":"Paciente CIAP Dois","data_nascimento":"1990-01-01","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.e('um'));
SELECT public.registrar_soap(pg_temp.e('um'), 'Sem queixas', 'PA 150x90', 'Hipertensão sem controle', 'Ajuste', NULL);
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_programada', '{}', '{}', '{alta_episodio}', NULL, '{K00}')$$,
  'CIAP-2 não encontrada na tabela do e-SUS APS: K00', 'CIAP fora da tabela é recusada');
SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_programada', '{}', '{}', '{retorno_cuidado_continuado}', NULL, '{k86, K86}');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND ciap_aps = '{K86}' AND problemas_aps = '{}' AND cid_aps = '{}'
                     FROM public.episodios WHERE id = pg_temp.e('um')), 'só a CIAP-2 basta como problema (normalizada e sem repetir)');
SET LOCAL ROLE authenticated;
-- quem chama sem a CIAP (a tela de antes) continua igual
SELECT public.iniciar_atendimento(pg_temp.e('dois'));
SELECT public.registrar_soap(pg_temp.e('dois'), 'Tosse seca', 'Ausculta limpa', 'IVAS', 'Sintomáticos', NULL);
SELECT public.registrar_conduta_aps(p_episodio => pg_temp.e('dois'), p_tipo => 'consulta_no_dia', p_problemas => '{}',
  p_cids => '{J06.9}', p_condutas => '{alta_episodio}');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND ciap_aps = '{}' AND cid_aps = '{J06.9}' FROM public.episodios WHERE id = pg_temp.e('dois')),
  'conduta sem CIAP continua valendo');
SELECT pg_temp.ok(to_regprocedure('public.registrar_conduta_aps(uuid, text, text[], text[], text[], text)') IS NULL,
  'a assinatura antiga saiu (sem ambiguidade na chamada)');
SELECT pg_temp.ok(has_function_privilege('authenticated', 'public.registrar_conduta_aps(uuid, text, text[], text[], text[], text, text[])', 'EXECUTE')
                  AND NOT has_function_privilege('anon', 'public.registrar_conduta_aps(uuid, text, text[], text[], text[], text, text[])', 'EXECUTE'),
  'grants da conduta mantidos');

ROLLBACK;
