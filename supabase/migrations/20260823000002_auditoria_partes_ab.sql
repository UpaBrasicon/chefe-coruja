-- ─────────────────────────────────────────────────────────────────────────────
-- CORREÇÕES DA AUDITORIA SUPABASE — 22/08/2026 — PARTES A e B
-- Projeto: chefe-coruja (saqjrjtrkzkswsxxvdxn) — sa-east-1
--
-- PARTE A: risco zero (revoke, STABLE, índice perfis, comentários).
-- PARTE B: correções verificadas contra o banco real antes de aplicar.
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- PARTE A — RISCO ZERO
-- =============================================================================

-- A1. Revogar privilégios que a RLS NÃO cobre (TRUNCATE/TRIGGER/REFERENCES).
revoke truncate, trigger, references
  on all tables in schema public
  from anon, authenticated;

alter default privileges in schema public
  revoke truncate, trigger, references on tables
  from anon, authenticated;

-- A2. Helpers de RLS como STABLE.
--     VERIFICADO em 22/08: os 8 helpers de RLS (private.eh_super_admin,
--     meu_perfil_id, papel_na_unidade, unidades_*, orgs_admin, eh_admin_da_
--     organizacao) JÁ SÃO STABLE. As 14 funções VOLATILE restantes são de
--     ESCRITA (registrar_*, enfileirar_*, handle_new_user, aplicar_troca,
--     notificar_vaga, pode_escrever_documento, tem_conflito_plantao,
--     valor_plantao, set_updated_at, validar_observacao) e NÃO podem virar
--     STABLE (função que escreve marcada STABLE é bug). Nada a fazer.
--     Mantido como salvaguarda idempotente para o futuro:
do $$
declare f record;
begin
  for f in
    select n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.provolatile = 'v'
      and p.proname in ('eh_super_admin','meu_perfil_id','papel_na_unidade',
                        'unidades_admin','unidades_do_usuario',
                        'unidades_gestor_plantonista','orgs_admin',
                        'eh_admin_da_organizacao')
  loop
    execute format('alter function %I.%I(%s) stable', f.nspname, f.proname, f.args);
  end loop;
end $$;

-- A3. Índice em perfis.id (coluna de auth) — VERIFICADO: a coluna de vínculo
--     com auth.users é `id` (uuid, NOT NULL, é a PRIMARY KEY da tabela), NÃO
--     existe `user_id`. A PK já indexa `id` — índice explícito redundante não
--     é criado. Mantido o CREATE para a coluna real como idempotente:
create index if not exists idx_perfis_id on public.perfis (id);

-- A4. Documentar o Bloco 2 (RLS sem policy) como intencional.
comment on table public.hermes_audit_log is
  'Acesso exclusivo via service_role. RLS ativa SEM policy é intencional: falha fechada para qualquer usuário autenticado. Ver auditoria 22/08/2026.';
comment on table public.hermes_sessions is
  'Acesso exclusivo via service_role. RLS ativa sem policy: intencional (falha fechada).';
comment on table public.cerbero_url_cache is
  'Acesso exclusivo via service_role. RLS ativa sem policy: intencional (falha fechada).';

-- A5. Documentar as views definer do Bloco 6.
comment on view public.vw_censo_unidade is
  'SECURITY DEFINER INTENCIONAL. Único caminho de leitura do admin (sem SELECT nas tabelas base). Aplica supressão LGPD de células 1-4 e filtro por unidade. NAO aplicar security_invoker=true.';
comment on view public.vw_indicadores_unidade is
  'SECURITY DEFINER INTENCIONAL. Ver comentário de vw_censo_unidade.';

-- =============================================================================
-- PARTE B — VERIFICADO ANTES DE APLICAR
-- =============================================================================

-- B1. auth.uid() → (select auth.uid()) nas policies de perfis.
--     VERIFICADO: o predicado real usa `id` (não user_id). A policy
--     perfis_select tem EXISTS aninhados — recriada com o texto EXATO atual
--     trocando apenas auth.uid() por (select auth.uid()).
drop policy if exists "perfis_select" on public.perfis;
create policy "perfis_select" on public.perfis
  for select to authenticated
  using (
    (id = (select auth.uid()))
    or private.eh_super_admin()
    or (
      exists (
        select 1
        from vinculos v
        join unidades u on u.id = v.unidade_id
        where v.perfil_id = perfis.id
          and u.organizacao_id in (select private.orgs_admin())
      )
      or (
        not exists (
          select 1 from vinculos v
          where v.perfil_id = perfis.id and v.ativo
        )
        and exists (select 1 from private.orgs_admin())
      )
    )
  );

drop policy if exists "perfis_update" on public.perfis;
create policy "perfis_update" on public.perfis
  for update to authenticated
  using      ((id = (select auth.uid())) or private.eh_super_admin())
  with check ((id = (select auth.uid())) or private.eh_super_admin());

drop policy if exists "perfis_update_proprio" on public.perfis;
create policy "perfis_update_proprio" on public.perfis
  for update to authenticated
  using      ((id = (select auth.uid())) or private.eh_super_admin())
  with check ((id = (select auth.uid())) or private.eh_super_admin());

-- B2. Policies USING(true) de medicamento(s).
--     VERIFICADO: roles = {authenticated} APENAS (catálogo restrito a
--     usuários logados — não vazou para anon/public). Design intencional:
--     todo plantonista consulta medicação; escrita só super_admin. NADA a
--     corrigir. Comentário documental:
comment on table public.medicamento is
  'Catálogo de medicamentos (fase 3, canônico). SELECT aberto a authenticated (leitura de identificação/diluição é intencional); escrita só super_admin. Ver auditoria 22/08/2026.';
comment on table public.medicamentos is
  'Tabela LEGACY da fase 2 (resíduo da merge). Usos no código: 0. Candidata a DROP após confirmação do usuário. Canônica atual: public.medicamento.';

-- B3. Revogar TODO acesso de anon (defense in depth).
--     VERIFICADO: 0 policies atendem anon/public → anon não precisa de nada
--     em public. Revoga tudo e impede que o default reconceda:
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- B4. Tabelas homônimas.
--     VERIFICADO em 22/08:
--       escala_plantao  (699 linhas) — CANÔNICA (15 usos no código)
--       escala_plantoes (15 linhas)  — resíduo (1 uso em useEscalaSetores)
--       medicamento     (200 linhas) — CANÔNICA (4 usos no código)
--       medicamentos    (71 linhas)  — resíduo (0 usos no código)
--     Nenhuma tem 0 linhas → NENHUM DROP automático (decisão do usuário).
--     Documentado para a próxima auditoria:
comment on table public.escala_plantoes is
  'Resíduo provável da merge legacy/escala. Canônica: public.escala_plantao (699 linhas). Avaliar DROP.';

-- B5. Publication do realtime.
--     VERIFICADO: supabase_realtime publica apenas chat_mensagens e
--     conversa_participantes (o que o frontend assina — correto). A
--     supabase_realtime_messages_publication contém só partições
--     realtime.messages_* (mecanismo interno do Supabase, não mexer).
--     O custo de WAL (51,6%) é do decoder do realtime, esperado com o
--     recurso ativo. NADA a corrigir.

-- ===========================================================================
-- DOWN (resumo)
--   -- Revokes são inversíveis apenas re-concedendo (fora de escopo aqui).
--   drop policy if exists "perfis_select" on public.perfis;
--   drop policy if exists "perfis_update" on public.perfis;
--   drop policy if exists "perfis_update_proprio" on public.perfis;
--   drop index if exists public.idx_perfis_id;
-- ===========================================================================
