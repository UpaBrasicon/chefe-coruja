// ─────────────────────────────────────────────────────────────────────────────
// HERMES — config/env.ts
// Carga e validação Zod das variáveis de ambiente. Falha rápido com mensagem
// clara se algo essencial faltar — nunca roda com configuração parcial.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod'

const schema = z.object({
  // Servidor
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Supabase — fonte da verdade
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, 'SUPABASE_SERVICE_ROLE_KEY obrigatória'),

  // Meta / WhatsApp Cloud API
  META_VERIFY_TOKEN: z.string().min(1, 'META_VERIFY_TOKEN obrigatório (handshake do webhook)'),
  META_APP_SECRET: z.string().min(1, 'META_APP_SECRET obrigatório (HMAC do webhook)'),
  META_ACCESS_TOKEN: z.string().min(1, 'META_ACCESS_TOKEN obrigatório (envio de mensagens)'),
  META_PHONE_NUMBER_ID: z.string().min(1, 'META_PHONE_NUMBER_ID obrigatório'),

  // LLM — DeepSeek V4 Flash (padrão do projeto, não trocar sem autorização)
  LLM_PROVIDER: z.enum(['deepseek']).default('deepseek'),
  LLM_BASE_URL: z.string().url().default('https://api.deepseek.com'),
  LLM_MODEL: z.string().default('deepseek-v4-flash'),
  LLM_API_KEY: z.string().default(''),

  // LLM fallback — Kimi K2.6 (opcional nesta fase)
  LLM_FALLBACK_BASE_URL: z.string().url().optional(),
  LLM_FALLBACK_MODEL: z.string().optional(),
  LLM_FALLBACK_API_KEY: z.string().optional(),

  // Redis (fila BullMQ)
  REDIS_URL: z.string().default('redis://redis:6379'),

  // Identidade de teste (do PREFLIGHT-HERMES.md)
  HERMES_ORG_TESTE_ID: z.string().uuid('HERMES_ORG_TESTE_ID deve ser uuid'),
})

function carregarEnv() {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const detalhes = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    console.error(`\n[env] Configuração inválida — corrija o .env:\n${detalhes}\n`)
    process.exit(1)
  }
  return parsed.data
}

export const env = carregarEnv()
export type Env = typeof env
