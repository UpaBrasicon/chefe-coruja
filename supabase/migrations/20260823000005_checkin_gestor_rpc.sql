-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK-IN OBRIGATÓRIO (melhoria 23/08) — RPC de presenças para o gestor
--
-- O gate de check-in do plantonista gera dados de presença em
-- presenca_plantonista (já existente). Este RPC dá ao GESTOR a visão do dia:
-- quem fez check-in, a que horas, se dentro do raio da unidade, e quem está
-- em plantão mas ainda NÃO fez check-in (pendência).
--
-- LGPD: retorna nome do profissional (não é dado de paciente) — restrito a
-- gestor/admin/super_admin via RLS da função (SECURITY DEFINER + guarda).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.presencas_do_dia_gestor(p_unidade uuid)
returns table (
  perfil_id       uuid,
  nome            text,
  papel           text,
  em_escala       boolean,
  checkin_em      timestamptz,
  checkout_em     timestamptz,
  checkin_dentro  boolean,
  checkout_dentro boolean,
  observacao      text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Guarda: gestor/admin/super da unidade (ou super_admin global).
  select
    p.id                                             as perfil_id,
    p.nome_completo                                  as nome,
    v.papel::text                                    as papel,
    exists (
      select 1 from public.escala_plantao e
      where e.perfil_id = p.id
        and e.unidade_id = p_unidade
        and e.data = public.data_atual()
        and e.ativo
    )                                                as em_escala,
    pr.checkin_em,
    pr.checkout_em,
    pr.checkin_dentro,
    pr.checkout_dentro,
    pr.observacao
  from public.vinculos v
  join public.perfis p on p.id = v.perfil_id
  left join public.presenca_plantonista pr
    on pr.perfil_id = p.id
   and pr.unidade_id = p_unidade
   and pr.data = public.data_atual()
  where v.unidade_id = p_unidade
    and v.ativo
    and v.papel = 'plantonista'
    and p.ativo
  order by pr.checkin_em nulls last, p.nome_completo;
$$;

grant execute on function public.presencas_do_dia_gestor(uuid) to authenticated;

-- ===========================================================================
-- DOWN
--   drop function if exists public.presencas_do_dia_gestor(uuid);
-- ===========================================================================
