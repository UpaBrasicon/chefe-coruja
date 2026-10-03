-- ════════════════════════════════════════════════════════════════════════════
-- Hermes — caminho B do cutover V1 (docs/seguranca/cutover-hermes-v1.md,
-- DESFECHO de 02/10/2026): o runtime sai da chave service_role e passa a
-- conectar no Postgres (pooler Supavisor) com dois papéis LOGIN de menor
-- privilégio, que herdam os papéis de 20261020000001:
--   • hermes_app_user  IN ROLE hermes_user — caminho de request. ZERO grant de
--     tabela; só EXECUTE nas RPCs scoped (SECURITY DEFINER, escopo no SQL).
--   • hermes_app_job   IN ROLE hermes_job  — crons. Grants mínimos.
--
-- SEM SENHA AQUI (nada de segredo no git). Enquanto a senha não for definida
-- pelo dono (ALTER ROLE ... PASSWORD no SQL editor), ninguém entra com esses
-- papéis. Os dois são NOSUPERUSER / NOBYPASSRLS: a RLS vale para eles.
--
-- Correção de rota descoberta neste corte: hermes_job tinha GRANT de tabela mas
-- NENHUMA política de RLS para ele. Sem BYPASSRLS, todo SELECT dos crons
-- voltaria vazio (silencioso) e todo INSERT falharia. Abaixo entram políticas
-- TO hermes_job espelhando exatamente os grants já existentes — nada além.
--
-- Revisão de 02/10 (20261022000002) tirou EXECUTE das funções hermes_* só de
-- PUBLIC/anon/authenticated; os grants a hermes_user/hermes_job ficaram. Mesmo
-- assim os GRANTs são repetidos aqui (idempotentes) para o corte não depender
-- do estado anterior. Nunca para anon/authenticated.
--
-- Reaplicável (CREATE ROLE condicional, ALTER ROLE, DROP POLICY IF EXISTS).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Papéis LOGIN (sem senha) ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_app_user') THEN
    CREATE ROLE hermes_app_user LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_app_job') THEN
    CREATE ROLE hermes_app_job LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

-- Reafirma os atributos mesmo se o papel já existia (ex.: criado à mão).
-- Limite de conexões: o Hermes abre no máximo 5 (user) / 3 (job); a folga
-- cobre o pooler reciclando conexões. (SUPERUSER/BYPASSRLS/REPLICATION não
-- entram no ALTER: no Supabase o `postgres` não é superuser e não pode nem
-- citar esses atributos — a checagem logo abaixo garante que estão desligados.)
ALTER ROLE hermes_app_user LOGIN INHERIT NOCREATEDB NOCREATEROLE CONNECTION LIMIT 10;
ALTER ROLE hermes_app_job  LOGIN INHERIT NOCREATEDB NOCREATEROLE CONNECTION LIMIT 6;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('hermes_app_user','hermes_app_job')
             AND (rolsuper OR rolbypassrls OR rolreplication OR rolcreaterole OR rolcreatedb)) THEN
    RAISE EXCEPTION 'hermes_app_user/hermes_app_job não podem ser superuser, bypassar RLS, replicar nem criar papel/banco';
  END IF;
END $$;

-- Tempo máximo por comando: request é interativo (WhatsApp), job pode varrer.
ALTER ROLE hermes_app_user SET statement_timeout = '15s';
ALTER ROLE hermes_app_user SET lock_timeout = '5s';
ALTER ROLE hermes_app_user SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE hermes_app_job  SET statement_timeout = '120s';
ALTER ROLE hermes_app_job  SET lock_timeout = '10s';
ALTER ROLE hermes_app_job  SET idle_in_transaction_session_timeout = '60s';

-- Herança dos grants mínimos. NÃO entram no authenticator (não há caminho via
-- PostgREST para estes papéis; só login direto no Postgres).
GRANT hermes_user TO hermes_app_user;
GRANT hermes_job  TO hermes_app_job;

-- ── Re-grant de EXECUTE (idempotente) ───────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.hermes_identidade_por_telefone(text)',
    'public.hermes_identidade_por_canal(text,text)',
    'public.hermes_unidade_setores(uuid,uuid)',
    'public.hermes_unidade_censo(uuid,uuid)',
    'public.hermes_unidade_indicadores(uuid,uuid)',
    'public.hermes_unidade_profissionais(uuid,uuid)',
    'public.hermes_unidade_resumo(uuid,uuid)',
    'public.hermes_unidade_internacoes_por_status(uuid,uuid)',
    'public.hermes_unidade_nomes(uuid,uuid)',
    'public.hermes_minhas_notificacoes(uuid,uuid,integer)',
    'public.hermes_alertas_escala(uuid,uuid,text[])',
    'public.hermes_relatorio_semanal_ultimo(uuid)',
    'public.hermes_incidentes_abertos(uuid,text,text)',
    'public.hermes_quarentena_pendente(uuid)',
    'public.hermes_integridade_resumo(uuid)',
    'public.hermes_liberar_quarentena(uuid,uuid)',
    'public.hermes_sessao_carregar(uuid,text)',
    'public.hermes_sessao_salvar(uuid,text,jsonb)',
    'public.hermes_audit_registrar(uuid,text,text,text,jsonb,text)',
    'public.hermes_quarentenar_conteudo(uuid,text,text,uuid,text,text,text,text,jsonb)',
    'public.hermes_plantoes_do_perfil(uuid,integer)',
    'public.hermes_plantao_do_dia(uuid,date)',
    'public.hermes_almanaque_buscar(text,integer)',
    'public.confirmar_vinculo_hermes(text,text,text)'
  ]
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hermes_user', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.hermes_plantoes_sobrepostos(integer)','public.hermes_perfis_sem_vinculo()',
    'public.hermes_crm_duplicado()','public.hermes_setores_ocupados_sem_plantao()',
    'public.hermes_porta_resumo(uuid,integer)','public.hermes_checkin_pendente()',
    'public.hermes_buracos_escala(integer)','public.hermes_revisoes_paradas()',
    'public.hermes_acessos_anomalos(integer,integer,integer)','public.hermes_cadeia_auditoria()'
  ]
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hermes_job', f);
  END LOOP;
END $$;

-- ── hermes_job: políticas de RLS espelhando os grants existentes ────────────
-- Leitura: as tabelas que os crons leem (GRANT SELECT de 20261020000001).
-- perfis continua limitado às colunas (id, nome_completo) pelo GRANT de coluna.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'unidades','censo_ocupacao','observacao','prescricoes','escala_plantao',
    'solicitacoes_escala','trocas_plantao','vinculos','hermes_audit_log',
    'cerbero_incidentes','chronos_alertas_escala','cerbero_quarentena','perfis',
    'cerbero_url_cache'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS hermes_job_select ON public.%I', t);
    EXECUTE format('CREATE POLICY hermes_job_select ON public.%I FOR SELECT TO hermes_job USING (true)', t);
  END LOOP;

  -- Escrita: as tabelas com GRANT INSERT.
  FOREACH t IN ARRAY ARRAY[
    'cerbero_incidentes','chronos_alertas_escala','notificacoes_plantonista',
    'gaviao_relatorios_semanais','ia_gateway_log','hermes_audit_log',
    'cerbero_quarentena','cerbero_url_cache'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS hermes_job_insert ON public.%I', t);
    EXECUTE format('CREATE POLICY hermes_job_insert ON public.%I FOR INSERT TO hermes_job WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Cache de URL do firewall de conteúdo (pipeline): o upsert (ON CONFLICT DO
-- UPDATE) precisa ler a linha existente e atualizar o veredicto. É só hash de
-- URL + veredicto (sem dado de paciente).
GRANT SELECT ON public.cerbero_url_cache TO hermes_job;
GRANT UPDATE (veredicto, fonte, detalhe) ON public.cerbero_url_cache TO hermes_job;
DROP POLICY IF EXISTS hermes_job_update ON public.cerbero_url_cache;
CREATE POLICY hermes_job_update ON public.cerbero_url_cache FOR UPDATE TO hermes_job USING (true) WITH CHECK (true);
