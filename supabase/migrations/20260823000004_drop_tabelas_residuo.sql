-- ─────────────────────────────────────────────────────────────────────────────
-- CORREÇÕES PÓS-AUDITORIA — DROP das tabelas resíduo — 23/08/2026
--
-- 1) escala_plantoes (Fase 2, legado): o hook useEscalaSetores foi migrado
--    para o RPC setores_na_escala_agora (lê da canônica escala_plantao).
--    0 referências vivas (funções/views/triggers/código) — verificado.
--
-- 2) medicamentos (Fase 2, legado): canônica é medicamento (Fase 3).
--    A FK prescricao_itens.medicamento_id apontava para a LEGADA (errada:
--    a tela grava IDs da canônica). As 3 linhas de prescricao_itens têm
--    medicamento_id NULL (dados de teste) → reatar a FK para medicamento
--    e dropar a legada.
--
-- DOWN: recria as tabelas (schema resumido) e a FK antiga.
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 1. Reatar FK de prescricao_itens para a tabela canônica
-- =============================================================================
alter table public.prescricao_itens
  drop constraint if exists prescricao_itens_medicamento_id_fkey;

alter table public.prescricao_itens
  add constraint prescricao_itens_medicamento_id_fkey
  foreign key (medicamento_id) references public.medicamento(id);

-- =============================================================================
-- 2. DROP escala_plantoes (legado Fase 2)
-- =============================================================================
drop table if exists public.escala_plantoes;

-- =============================================================================
-- 3. DROP medicamentos (legado Fase 2)
-- =============================================================================
drop table if exists public.medicamentos;

-- ===========================================================================
-- DOWN
--   -- recria escala_plantoes (schema Fase 2)
--   create table public.escala_plantoes (
--     id uuid primary key default gen_random_uuid(),
--     unidade_id uuid not null references public.unidades(id) on delete cascade,
--     setor_id   uuid not null references public.setores(id) on delete cascade,
--     perfil_id  uuid not null references public.perfis(id) on delete cascade,
--     data       date not null,
--     turno      text not null,
--     ativo      boolean not null default true,
--     criado_por uuid references public.perfis(id),
--     created_at timestamptz not null default now(),
--     updated_at timestamptz not null default now()
--   );
--   -- recria medicamentos (schema Fase 2)
--   create table public.medicamentos (
--     id uuid primary key default gen_random_uuid(),
--     nome text not null,
--     principio_ativo text,
--     concentracao text,
--     forma_farmaceutica text,
--     apresentacao text,
--     via text,
--     unidade text,
--     tipo_receituario text,
--     controlado boolean default false,
--     codigo_anvisa text
--   );
--   -- devolve a FK antiga
--   alter table public.prescricao_itens
--     drop constraint if exists prescricao_itens_medicamento_id_fkey;
--   alter table public.prescricao_itens
--     add constraint prescricao_itens_medicamento_id_fkey
--     foreign key (medicamento_id) references public.medicamentos(id);
-- ===========================================================================
