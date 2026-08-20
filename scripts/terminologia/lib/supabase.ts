// ─────────────────────────────────────────────────────────────────────────────
// Cliente Supabase para importação — SEMPRE com service_role (nunca anon).
// Roda apenas em ambiente local/CI. A service_role key nunca deve ser exposta
// no cliente (VITE_*).
//
// O tipo `ClienteTerminologia` declara apenas o contrato usado pelos scripts
// (from().select().in() e from().upsert()) — evita brigar com os generics do
// supabase-js e mantém o cast isolado no factory.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

export type RespostaDb<T> = Promise<{
  data: T | null
  error: { message: string } | null
}>

export type ClienteTerminologia = {
  from(tabela: string): {
    select(colunas: string): {
      in(chave: string, valores: string[]): RespostaDb<Record<string, unknown>[]>
    }
    upsert(
      linhas: Record<string, unknown>[],
      opts?: { onConflict?: string }
    ): RespostaDb<Record<string, unknown>[]>
  }
  rpc(funcao: string, args?: Record<string, unknown>): RespostaDb<Record<string, unknown>[]>
}

/** Cria o cliente apontando para o schema `terminologia`. */
export function criarCliente(): ClienteTerminologia {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias (use .env.local). ' +
        'A service_role key NUNCA vai para o cliente (VITE_*).'
    )
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'terminologia' },
  })
  return client as unknown as ClienteTerminologia
}
