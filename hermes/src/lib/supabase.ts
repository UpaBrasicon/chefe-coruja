// ─────────────────────────────────────────────────────────────────────────────
// HERMES — lib/supabase.ts
// Cliente Supabase com a service_role key. Singleton.
//
// ⚠️ REGRA 3 (regras transversais): o RLS NÃO protege chamadas com service_role.
// A camada de tools do Hermes é RESPONSÁVEL por filtrar por user_id/unidade_id
// resolvidos a partir do telefone — nunca confiar em "já está filtrado".
// ─────────────────────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

export function criarClienteSupabase(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// Singleton — a app inteira compartilha o mesmo cliente.
export const supabase = criarClienteSupabase()
