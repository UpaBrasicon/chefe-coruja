// ─────────────────────────────────────────────────────────────────────────────
// HERMES — lib/supabase.ts
// Acesso ao banco, por caminho (cutover V1 — docs/seguranca/cutover-hermes-v1.md,
// DESFECHO de 02/10/2026, caminho B):
//   • supabaseUser (hermes_app_user → hermes_user) — caminho de request. É SÓ
//     `.rpc()` (o tipo ClienteRpc não tem `.from()`), restrito às RPCs scoped
//     da allowlist RPC_USUARIO. Zero grant de tabela no banco.
//   • supabaseJob  (hermes_app_job → hermes_job) — crons: `.rpc()` das RPCs de
//     verificação (RPC_JOB). As leituras/escritas de tabela dos crons ficam em
//     lib/db-job.ts (postgres.js direto).
//   • supabase (service_role) — LEGADO. Bypassa RLS. Só existe enquanto
//     HERMES_SEM_SERVICE_ROLE não está ligado; com a flag, qualquer uso lança.
//
// Envs:
//   HERMES_PG_USER_URL / HERMES_PG_JOB_URL — connection strings do pooler.
//     Ausentes → fallback para a service_role, com AVISO alto no log.
//   HERMES_SEM_SERVICE_ROLE=1 — o processo NÃO sobe sem as duas URLs (ver
//     config/env.ts) e o cliente service_role fica indisponível.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'
import { criarRpcPg, criarSql, erroPg, type ClienteRpc, type RpcResposta, type Sql } from './pg.js'

export type { ClienteRpc, RpcErro, RpcResposta } from './pg.js'

/** RPCs que o caminho de request pode chamar (todas com EXECUTE para hermes_user). */
export const RPC_USUARIO: ReadonlySet<string> = new Set([
  'hermes_identidade_por_telefone',
  'hermes_identidade_por_canal',
  'hermes_unidade_setores',
  'hermes_unidade_censo',
  'hermes_unidade_indicadores',
  'hermes_unidade_profissionais',
  'hermes_unidade_resumo',
  'hermes_unidade_internacoes_por_status',
  'hermes_unidade_nomes',
  'hermes_minhas_notificacoes',
  'hermes_alertas_escala',
  'hermes_relatorio_semanal_ultimo',
  'hermes_incidentes_abertos',
  'hermes_quarentena_pendente',
  'hermes_integridade_resumo',
  'hermes_liberar_quarentena',
  'hermes_sessao_carregar',
  'hermes_sessao_salvar',
  'hermes_audit_registrar',
  'hermes_quarentenar_conteudo',
  'hermes_plantoes_do_perfil',
  'hermes_plantao_do_dia',
  'hermes_almanaque_buscar',
  'confirmar_vinculo_hermes',
])

/** RPCs de verificação dos crons (EXECUTE para hermes_job). */
export const RPC_JOB: ReadonlySet<string> = new Set([
  'hermes_plantoes_sobrepostos',
  'hermes_perfis_sem_vinculo',
  'hermes_crm_duplicado',
  'hermes_setores_ocupados_sem_plantao',
  'hermes_porta_resumo',
  'hermes_checkin_pendente',
  'hermes_buracos_escala',
  'hermes_revisoes_paradas',
  'hermes_acessos_anomalos',
  'hermes_cadeia_auditoria',
])

export const semServiceRole = env.HERMES_SEM_SERVICE_ROLE

// ── service_role (legado, preguiçoso) ────────────────────────────────────────
let clienteService: SupabaseClient | null = null

function servico(): SupabaseClient {
  if (semServiceRole) {
    throw new Error('[supabase] HERMES_SEM_SERVICE_ROLE=1: o cliente service_role está desligado neste processo')
  }
  if (!clienteService) {
    clienteService = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return clienteService
}

/**
 * Cliente service_role (bypassa RLS). LEGADO: só o fallback de lib/db-job.ts e
 * os testes de integração usam. Criado no primeiro uso; com
 * HERMES_SEM_SERVICE_ROLE=1, qualquer acesso lança.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_alvo, prop) {
    const real = servico()
    const v = Reflect.get(real, prop, real) as unknown
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v
  },
})

/** `.rpc()` pela service_role, mas com a MESMA allowlist do caminho novo. */
function rpcViaServiceRole(permitidas: ReadonlySet<string>): ClienteRpc {
  return {
    async rpc(nome, params = {}) {
      if (!permitidas.has(nome)) {
        return { data: null, error: { message: `Função não permitida neste caminho: ${nome}`, code: 'HRM01', details: null, hint: null } }
      }
      try {
        const r = await servico().rpc(nome, params)
        const error = r.error
          ? { message: r.error.message, code: r.error.code ?? '', details: r.error.details ?? null, hint: r.error.hint ?? null }
          : null
        return { data: r.data ?? null, error } satisfies RpcResposta
      } catch (err) {
        return { data: null, error: erroPg(err) }
      }
    },
  }
}

// ── Conexões Postgres de menor privilégio ────────────────────────────────────
const sqlUser: Sql | null = env.HERMES_PG_USER_URL ? criarSql(env.HERMES_PG_USER_URL, 'user') : null

/** Conexão do job (hermes_app_job), ou null no fallback. Usada por lib/db-job.ts. */
export const sqlJob: Sql | null = env.HERMES_PG_JOB_URL ? criarSql(env.HERMES_PG_JOB_URL, 'job') : null

if (!sqlUser || !sqlJob) {
  const faltam = [!sqlUser && 'HERMES_PG_USER_URL', !sqlJob && 'HERMES_PG_JOB_URL'].filter(Boolean).join(', ')
  console.warn(
    '\n' +
      '!!! ═══════════════════════════════════════════════════════════════════\n' +
      `!!! [supabase] ${faltam} ausente(s): o Hermes está usando a SERVICE_ROLE\n` +
      '!!! (bypassa toda a RLS) nesse caminho. Configure as URLs do pooler e\n' +
      '!!! depois ligue HERMES_SEM_SERVICE_ROLE=1 (docs/seguranca/cutover-hermes-v1.md).\n' +
      '!!! ═══════════════════════════════════════════════════════════════════\n',
  )
}

/** Caminho de request: só `.rpc()`, só RPC_USUARIO. */
export const supabaseUser: ClienteRpc = sqlUser ? criarRpcPg(sqlUser, RPC_USUARIO) : rpcViaServiceRole(RPC_USUARIO)

/** Crons: só `.rpc()`, só RPC_JOB. Tabelas: lib/db-job.ts. */
export const supabaseJob: ClienteRpc = sqlJob ? criarRpcPg(sqlJob, RPC_JOB) : rpcViaServiceRole(RPC_JOB)

/** Modo atual, para log e /health. */
export function modoBanco(): { user: 'postgres' | 'service_role'; job: 'postgres' | 'service_role' } {
  return { user: sqlUser ? 'postgres' : 'service_role', job: sqlJob ? 'postgres' : 'service_role' }
}

/** Healthcheck: as duas conexões respondem? */
export async function bancoResponde(): Promise<boolean> {
  try {
    if (sqlUser) await sqlUser`select 1`
    else {
      const { error } = await servico().from('unidades').select('id').limit(1)
      if (error) return false
    }
    if (sqlJob) await sqlJob`select 1`
    return true
  } catch {
    return false
  }
}

/** Fecha as conexões (testes / encerramento). */
export async function fecharBanco(): Promise<void> {
  await Promise.all([sqlUser?.end({ timeout: 5 }), sqlJob?.end({ timeout: 5 })])
}
