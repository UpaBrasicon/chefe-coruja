-- Testes de public.hermes_maestro_totais() (migration 20261022000008 — o
-- maestro do Coruja Lab). Prova que só o job executa, que a saída é só
-- contagem (nenhuma chave de pessoa/texto, nenhum texto livre vazado) e que os
-- números batem com o que foi inserido. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/hermes_maestro_totais.sql
BEGIN;

GRANT hermes_app_job  TO postgres WITH INHERIT FALSE, SET TRUE;
GRANT hermes_app_user TO postgres WITH INHERIT FALSE, SET TRUE;

-- ── Privilégios ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT has_function_privilege('hermes_job', 'public.hermes_maestro_totais()', 'EXECUTE')
     OR NOT has_function_privilege('hermes_app_job', 'public.hermes_maestro_totais()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU M1: hermes_job/hermes_app_job sem EXECUTE';
  END IF;
  IF has_function_privilege('anon', 'public.hermes_maestro_totais()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.hermes_maestro_totais()', 'EXECUTE')
     OR has_function_privilege('hermes_app_user', 'public.hermes_maestro_totais()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU M1: anon/authenticated/hermes_app_user executam a função do maestro';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.hermes_maestro_totais()'::regprocedure
                 AND prosecdef AND proconfig @> ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'FALHOU M1: função sem SECURITY DEFINER ou sem search_path vazio';
  END IF;
  RAISE NOTICE 'OK  M1: só hermes_job (e service_role) executa; SECURITY DEFINER com search_path vazio';
END $$;

-- ── Dados plantados (texto livre que NÃO pode sair) ──────────────────────────
INSERT INTO public.ia_gateway_log (origem, perfil_id, bloqueado, residuos, hash_entrada, erro) VALUES
  ('maestroteste:telegram', '10000000-0000-4000-8000-000000000002', false, 0, repeat('a', 64), NULL),
  ('maestroteste:telegram', NULL, true, 2, repeat('b', 64), NULL),
  ('maestroteste:telegram', NULL, true, 0, repeat('c', 64),
   'gateway: desidentificação indisponível (http: 503); chamada não enviada'),
  ('maestroteste:telegram', NULL, false, 0, repeat('d', 64), 'provedor caiu ao ler SEGREDO_MAESTRO Fulano de Tal'),
  ('Origem Livre SEGREDO_MAESTRO', NULL, false, 0, repeat('e', 64), NULL);
INSERT INTO public.cerbero_incidentes (patrulha, severidade, titulo, evidencia, chave_dedup)
VALUES ('hermes', 'atencao', 'SEGREDO_MAESTRO título', '{"trecho":"SEGREDO_MAESTRO"}'::jsonb, 'teste:maestro:1');
INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, tipo, mensagem, data) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', 'maestro_teste', 'SEGREDO_MAESTRO oi', current_date),
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', 'Tipo Livre SEGREDO_MAESTRO', 'x', current_date);

-- ── Executa como hermes_app_job ──────────────────────────────────────────────
SET LOCAL ROLE hermes_app_job;

DO $$
DECLARE v jsonb; g jsonb; proibidas text[]; n int;
BEGIN
  v := public.hermes_maestro_totais();
  IF NOT (v ?& ARRAY['janela_dias','desde','ate','gateway','incidentes','alertas','notificacoes'])
     OR (v->>'janela_dias')::int <> 7 THEN
    RAISE EXCEPTION 'FALHOU M2: formato inesperado: %', left(v::text, 300);
  END IF;

  SELECT array_agg(DISTINCT k) INTO proibidas
    FROM jsonb_path_query(v, 'lax $.**') AS j,
         jsonb_object_keys(CASE WHEN jsonb_typeof(j) = 'object' THEN j ELSE '{}'::jsonb END) AS k
   WHERE k ~* '(perfil|nome|texto|trecho|email|e_mail|hash|titulo|mensagem|detalhe|evidencia|medico|paciente|_id$|^id$)';
  IF proibidas IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU M2: chave proibida na saída: %', proibidas;
  END IF;
  IF v::text ~* '(SEGREDO_MAESTRO|Fulano|10000000-0000-4000-8000-000000000002|aaaaaaaaaaaaaaaa)' THEN
    RAISE EXCEPTION 'FALHOU M2: texto livre, id ou hash vazou na saída';
  END IF;
  RAISE NOTICE 'OK  M2: saída só com contagens (sem perfil_id/nome/texto/trecho/email/hash, sem texto livre)';

  SELECT x INTO g FROM jsonb_array_elements(v->'gateway') x
   WHERE x->>'origem' = 'maestroteste:telegram' AND (x->>'dia')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  IF g IS NULL OR (g->>'total')::int <> 4 OR (g->>'bloqueados')::int <> 2 OR (g->>'com_erro')::int <> 2
     OR (g->>'erros_desidentificacao')::int <> 1 OR (g->>'erros_modelo')::int <> 1 OR (g->>'residuos')::int <> 2
     OR g->'motivos_desidentificacao' <> '{"http": 1}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU M3: contagem do gateway errada: %', g;
  END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(v->'gateway') x WHERE x->>'origem' = 'outra';
  IF n < 1 THEN RAISE EXCEPTION 'FALHOU M3: origem fora do formato não virou "outra"'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'incidentes') x
                 WHERE x->>'patrulha' = 'hermes' AND x->>'severidade' = 'atencao' AND x->>'status' = 'aberto'
                   AND (x->>'total')::int >= 1) THEN
    RAISE EXCEPTION 'FALHOU M3: incidente plantado não contado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'notificacoes') x
                 WHERE x->>'tipo' = 'maestro_teste' AND (x->>'total')::int = 1)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'notificacoes') x WHERE x->>'tipo' = 'outro') THEN
    RAISE EXCEPTION 'FALHOU M3: notificações por tipo erradas';
  END IF;
  IF jsonb_typeof(v->'alertas') <> 'array' THEN RAISE EXCEPTION 'FALHOU M3: alertas não é lista'; END IF;
  RAISE NOTICE 'OK  M3: contagens por origem/dia, incidentes e notificações batem com o plantado';
END $$;

RESET ROLE;

-- ── authenticated, anon e o caminho de request não executam ─────────────────
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.hermes_maestro_totais();
  RAISE EXCEPTION 'FALHOU M4: authenticated executou hermes_maestro_totais';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  M4: authenticated negado';
END $$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM public.hermes_maestro_totais();
  RAISE EXCEPTION 'FALHOU M4: anon executou hermes_maestro_totais';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  M4: anon negado';
END $$;
RESET ROLE;

SET LOCAL ROLE hermes_app_user;
DO $$
BEGIN
  PERFORM public.hermes_maestro_totais();
  RAISE EXCEPTION 'FALHOU M4: hermes_app_user executou hermes_maestro_totais';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  M4: hermes_app_user (caminho de request) negado';
END $$;
RESET ROLE;

ROLLBACK;
