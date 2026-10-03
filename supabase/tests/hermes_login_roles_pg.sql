-- Testes dos papéis LOGIN do Hermes (migration 20261022000007 — caminho B do
-- cutover V1). Prova que hermes_app_user só executa as RPCs scoped (zero
-- tabela, nenhuma outra função) e que hermes_app_job lê/escreve só o que os
-- crons precisam, com a RLS valendo. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/hermes_login_roles_pg.sql
-- Ids do seed: plantonista ...0002 (unidade 21..01); unidade 00..0101 sem vínculo dele.
BEGIN;

-- O `postgres` do Supabase não é superuser: para o teste poder "virar" os
-- papéis, ganha SET (sem INHERIT) dentro desta transação — o ROLLBACK desfaz.
GRANT hermes_app_user TO postgres WITH INHERIT FALSE, SET TRUE;
GRANT hermes_app_job  TO postgres WITH INHERIT FALSE, SET TRUE;

-- ── Atributos dos papéis ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('hermes_app_user','hermes_app_job')
        AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole
        AND NOT rolcreatedb AND NOT rolreplication AND rolinherit) <> 2 THEN
    RAISE EXCEPTION 'FALHOU PG1: papéis ausentes ou com atributo perigoso (super/bypassrls/createrole...)';
  END IF;
  IF NOT pg_has_role('hermes_app_user', 'hermes_user', 'USAGE')
     OR NOT pg_has_role('hermes_app_job', 'hermes_job', 'USAGE') THEN
    RAISE EXCEPTION 'FALHOU PG1: login roles não herdam hermes_user/hermes_job';
  END IF;
  IF pg_has_role('hermes_app_user', 'hermes_job', 'USAGE') OR pg_has_role('hermes_app_job', 'hermes_user', 'USAGE')
     OR pg_has_role('authenticator', 'hermes_app_user', 'MEMBER') OR pg_has_role('authenticator', 'hermes_app_job', 'MEMBER') THEN
    RAISE EXCEPTION 'FALHOU PG1: papéis cruzados (user↔job) ou expostos ao authenticator';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hermes_app_user'
                 AND rolconfig @> ARRAY['statement_timeout=15s'] AND rolconnlimit BETWEEN 1 AND 20) THEN
    RAISE EXCEPTION 'FALHOU PG1: hermes_app_user sem statement_timeout/limite de conexões';
  END IF;
  RAISE NOTICE 'OK  PG1: login roles sem superuser/bypassrls, herdando só o papel certo, com limites';
END $$;

-- ── hermes_app_user: zero tabela, só as RPCs da allowlist ───────────────────
DO $$
DECLARE n int; f text;
  permitidas text[] := ARRAY[
    'hermes_identidade_por_telefone','hermes_identidade_por_canal','hermes_unidade_setores',
    'hermes_unidade_censo','hermes_unidade_indicadores','hermes_unidade_profissionais',
    'hermes_unidade_resumo','hermes_unidade_internacoes_por_status','hermes_unidade_nomes',
    'hermes_minhas_notificacoes','hermes_alertas_escala','hermes_relatorio_semanal_ultimo',
    'hermes_incidentes_abertos','hermes_quarentena_pendente','hermes_integridade_resumo',
    'hermes_liberar_quarentena','hermes_sessao_carregar','hermes_sessao_salvar',
    'hermes_audit_registrar','hermes_quarentenar_conteudo','hermes_plantoes_do_perfil',
    'hermes_plantao_do_dia','hermes_almanaque_buscar','confirmar_vinculo_hermes'];
BEGIN
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
   WHERE s.nspname IN ('public','private','auth','storage') AND c.relkind IN ('r','v','m','p','f')
     AND has_table_privilege('hermes_app_user', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE');
  IF n > 0 THEN RAISE EXCEPTION 'FALHOU PG2: hermes_app_user tem privilégio em % tabela(s)', n; END IF;

  FOREACH f IN ARRAY permitidas LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
                   WHERE s.nspname = 'public' AND p.proname = f
                     AND has_function_privilege('hermes_app_user', p.oid, 'EXECUTE')) THEN
      RAISE EXCEPTION 'FALHOU PG2: hermes_app_user não executa %', f;
    END IF;
  END LOOP;

  -- Nenhuma outra função do schema public (nem as dos crons, nem as do app).
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
   WHERE s.nspname = 'public' AND NOT (p.proname = ANY (permitidas))
     AND has_function_privilege('hermes_app_user', p.oid, 'EXECUTE');
  IF n > 0 THEN RAISE EXCEPTION 'FALHOU PG2: hermes_app_user executa % função(ões) fora da allowlist', n; END IF;
  IF has_schema_privilege('hermes_app_user', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'FALHOU PG2: hermes_app_user com USAGE em private';
  END IF;
  RAISE NOTICE 'OK  PG2: hermes_app_user = zero tabela + só as 24 RPCs do caminho de request';
END $$;

-- Executa de verdade como hermes_app_user.
SET LOCAL ROLE hermes_app_user;

DO $$
DECLARE n int; v jsonb;
BEGIN
  SELECT count(*) INTO n FROM public.hermes_unidade_setores(
    '10000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001');
  IF n < 1 THEN RAISE EXCEPTION 'FALHOU PG3: membro não viu setores pela RPC'; END IF;

  PERFORM public.hermes_sessao_salvar('10000000-0000-4000-8000-000000000002', 'teste-pg-login', '[{"role":"user","content":"oi"}]'::jsonb);
  v := public.hermes_sessao_carregar('10000000-0000-4000-8000-000000000002', 'teste-pg-login');
  IF v->0->>'content' IS DISTINCT FROM 'oi' THEN RAISE EXCEPTION 'FALHOU PG3: sessão não voltou (%)', v; END IF;
  RAISE NOTICE 'OK  PG3: hermes_app_user executa as RPCs (leitura e escrita via SECURITY DEFINER)';
END $$;

DO $$
BEGIN
  PERFORM public.hermes_unidade_censo(
    '10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000101');
  RAISE EXCEPTION 'FALHOU PG4: cross-tenant passou como hermes_app_user';
EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Acesso negado%' THEN RAISE EXCEPTION 'FALHOU PG4: erro inesperado: %', SQLERRM; END IF;
  RAISE NOTICE 'OK  PG4: escopo da RPC vale também para o login role (cross-tenant negado)';
END $$;

DO $$
BEGIN
  PERFORM 1 FROM public.perfis LIMIT 1;
  RAISE EXCEPTION 'FALHOU PG5: hermes_app_user leu perfis';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  PG5: SELECT em perfis negado';
END $$;

DO $$
BEGIN
  INSERT INTO public.hermes_sessions (user_id, phone, messages)
  VALUES ('10000000-0000-4000-8000-000000000002', 'teste-pg-invasor', '[]'::jsonb);
  RAISE EXCEPTION 'FALHOU PG5: hermes_app_user inseriu em hermes_sessions direto';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  PG5: INSERT direto em tabela negado';
END $$;

DO $$
BEGIN
  PERFORM public.hermes_checkin_pendente();
  RAISE EXCEPTION 'FALHOU PG6: hermes_app_user executou RPC de cron';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  PG6: RPC de cron negada ao caminho de request';
END $$;

DO $$
BEGIN
  PERFORM public.solicitar_codigo_2fa('10000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'FALHOU PG6: hermes_app_user pediu código de 2FA';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  PG6: função de outro domínio (2FA, só service_role) negada';
END $$;

RESET ROLE;

-- ── hermes_app_job: grants mínimos com RLS valendo ──────────────────────────
SET LOCAL ROLE hermes_app_job;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.unidades WHERE ativo;
  IF n < 1 THEN RAISE EXCEPTION 'FALHOU PG7: job não vê unidades (falta política de RLS?)'; END IF;
  SELECT count(*) INTO n FROM public.vinculos;
  IF n < 1 THEN RAISE EXCEPTION 'FALHOU PG7: job não vê vínculos'; END IF;
  PERFORM count(*) FROM public.hermes_checkin_pendente();

  INSERT INTO public.cerbero_incidentes (patrulha, severidade, titulo, evidencia, chave_dedup)
  VALUES ('dados', 'informativo', 'teste pg login', '{}'::jsonb, 'teste:pg-login')
  ON CONFLICT (chave_dedup) WHERE status IN ('aberto','em_analise') DO NOTHING;
  INSERT INTO public.cerbero_incidentes (patrulha, severidade, titulo, evidencia, chave_dedup)
  VALUES ('dados', 'informativo', 'teste pg login', '{}'::jsonb, 'teste:pg-login')
  ON CONFLICT (chave_dedup) WHERE status IN ('aberto','em_analise') DO NOTHING;
  SELECT count(*) INTO n FROM public.cerbero_incidentes WHERE chave_dedup = 'teste:pg-login';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU PG7: dedup do incidente deu % linha(s)', n; END IF;

  INSERT INTO public.cerbero_url_cache (url_hash, veredicto, fonte) VALUES ('teste-pg', 'suspeito', 'heuristica')
  ON CONFLICT (url_hash) DO UPDATE SET veredicto = excluded.veredicto;
  INSERT INTO public.cerbero_url_cache (url_hash, veredicto, fonte) VALUES ('teste-pg', 'suspeito', 'heuristica')
  ON CONFLICT (url_hash) DO UPDATE SET veredicto = excluded.veredicto;

  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, tipo, mensagem, data)
  VALUES ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', 'teste', 'oi', current_date);
  INSERT INTO public.ia_gateway_log (origem, bloqueado, hash_entrada) VALUES ('teste', false, repeat('a', 64));
  PERFORM p.id, p.nome_completo FROM public.perfis p LIMIT 1;  -- id/nome_completo: permitido
  RAISE NOTICE 'OK  PG7: job lê o que precisa e escreve incidente/cache/notificação/log (RLS com política)';
END $$;

DO $$
BEGIN
  PERFORM p.email FROM public.perfis p LIMIT 1;
  RAISE EXCEPTION 'FALHOU PG8: job leu perfis.email';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  PG8: job só lê id/nome_completo de perfis';
END $$;

DO $$
BEGIN
  PERFORM 1 FROM public.pacientes LIMIT 1;
  RAISE EXCEPTION 'FALHOU PG8: job leu pacientes';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  PG8: job sem acesso a pacientes';
END $$;

DO $$
BEGIN
  PERFORM public.hermes_sessao_carregar('10000000-0000-4000-8000-000000000002', 'x');
  RAISE EXCEPTION 'FALHOU PG8: job executou RPC do caminho de request';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  PG8: RPC de request negada ao job';
END $$;

DO $$
BEGIN
  UPDATE public.cerbero_incidentes SET status = 'resolvido' WHERE chave_dedup = 'teste:pg-login';
  RAISE EXCEPTION 'FALHOU PG8: job atualizou incidente';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  PG8: job não altera incidente (só insere)';
END $$;

RESET ROLE;
ROLLBACK;
