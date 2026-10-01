// ─────────────────────────────────────────────────────────────────────────────
// HERMES — lib/supabase.ts
// Clientes Supabase. Até o cutover V1 (docs/seguranca/cutover-hermes-v1.md), os
// três apontam para a mesma service_role — nada muda. No cutover, os JWTs dos
// papéis de menor privilégio entram via HERMES_USER_KEY / HERMES_JOB_KEY:
//   • supabaseUser (hermes_user) — caminho de request; só EXECUTE nas RPCs
//     scoped, ZERO grant de tabela. Um bug no filtro NÃO alcança outro tenant.
//   • supabaseJob  (hermes_job)  — crons; grants mínimos SELECT/INSERT.
//   • supabase (service_role)    — legado; removido do runtime no passo 5 do
//     cutover, depois de §2-4 testadas.
//
// ⚠️ Enquanto as envs novas não existem, o fallback é a service_role (que
// bypassa RLS): a camada de código segue responsável por filtrar por
// user_id/unidade_id — nunca confiar em "já está filtrado".
// ─────────────────────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

function criarCliente(key: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function criarClienteSupabase(): SupabaseClient {
  return criarCliente(env.SUPABASE_SERVICE_ROLE_KEY)
}

// Singleton legado (service_role) — ainda usado por qualquer coisa não migrada.
export const supabase = criarClienteSupabase()

// Caminho de request (hermes_user). Fallback para a service_role enquanto a env
// nova não existe, para nada quebrar antes da troca de chave no VPS.
export const supabaseUser = criarCliente(process.env.HERMES_USER_KEY || env.SUPABASE_SERVICE_ROLE_KEY)

// Crons (hermes_job). Mesmo fallback.
export const supabaseJob = criarCliente(process.env.HERMES_JOB_KEY || env.SUPABASE_SERVICE_ROLE_KEY)
