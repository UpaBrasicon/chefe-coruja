// ─────────────────────────────────────────────────────────────────────────────
// HERMES — lib/llm.ts
// Camada LLM (stub da Fase 0 — o loop completo do agente vem na Fase 1).
//
// Nesta fase entrega: cliente OpenAI-compatible parametrizado por
// LLM_BASE_URL + LLM_MODEL (default DeepSeek V4 Flash), timeout 60s, 1 retry
// com backoff, fallback opcional (Kimi), e um teste de fumaça executável
// (`npm run test:llm`) que responde "hermes online".
//
// ⚠️ Modo thinking: NÃO fixado ainda — a Fase 1 consulta a doc oficial do
// DeepSeek para o nome exato do parâmetro da build atual antes de ativar.
// ─────────────────────────────────────────────────────────────────────────────
import { env } from '../config/env.js'
import { logger } from '../logger.js'

export type MensagemLLM = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export type ChamadaLLM = {
  mensagens: MensagemLLM[]
  /** Reservado: ativar apenas em jobs semanais (Fase 4), nunca no chat de rotina. */
  thinking?: boolean
  maxTokens?: number
}

export type RespostaLLM = {
  conteudo: string
  provedor: 'primario' | 'fallback'
  modelo: string
  latenciaMs: number
}

const TIMEOUT_MS = 60_000

async function chamarProvedor(
  baseUrl: string,
  modelo: string,
  apiKey: string,
  body: ChamadaLLM
): Promise<{ conteudo: string; latenciaMs: number }> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const inicio = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelo,
      messages: body.mensagens,
      max_tokens: body.maxTokens ?? 512,
      stream: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!res.ok) {
    const texto = await res.text().catch(() => '')
    throw new Error(`LLM HTTP ${res.status}: ${texto.slice(0, 300)}`)
  }

  const dados = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const conteudo = dados.choices?.[0]?.message?.content
  if (!conteudo) throw new Error('LLM retornou resposta sem conteúdo')
  return { conteudo, latenciaMs: Date.now() - inicio }
}

export async function completar(body: ChamadaLLM): Promise<RespostaLLM> {
  // Tenta o provedor primário (DeepSeek) com 1 retry/backoff.
  try {
    try {
      const r = await chamarProvedor(env.LLM_BASE_URL, env.LLM_MODEL, env.LLM_API_KEY, body)
      return { ...r, provedor: 'primario', modelo: env.LLM_MODEL }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, '[llm] primário falhou, tentando retry')
      const r = await chamarProvedor(env.LLM_BASE_URL, env.LLM_MODEL, env.LLM_API_KEY, body)
      return { ...r, provedor: 'primario', modelo: env.LLM_MODEL }
    }
  } catch (errPrimario) {
    // Fallback opcional (Kimi) — apenas 1 tentativa.
    if (env.LLM_FALLBACK_BASE_URL && env.LLM_FALLBACK_API_KEY && env.LLM_FALLBACK_MODEL) {
      try {
        const r = await chamarProvedor(
          env.LLM_FALLBACK_BASE_URL,
          env.LLM_FALLBACK_MODEL,
          env.LLM_FALLBACK_API_KEY,
          body
        )
        return { ...r, provedor: 'fallback', modelo: env.LLM_FALLBACK_MODEL }
      } catch (errFallback) {
        throw new Error(
          `LLM primário e fallback falharam: ${(errPrimario as Error).message} | fallback: ${(errFallback as Error).message}`
        )
      }
    }
    throw errPrimario
  }
}

/** Teste de fumaça — `npm run test:llm`. Espera "hermes online". */
export async function testarConexao(): Promise<RespostaLLM> {
  return completar({
    mensagens: [{ role: 'user', content: 'responda apenas: hermes online' }],
    maxTokens: 16,
  })
}

// Execução direta: node/tsx src/lib/llm.ts
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  testarConexao()
    .then((r) => {
      console.log(`[llm] ${r.provedor}/${r.modelo} (${r.latenciaMs}ms): ${r.conteudo}`)
      process.exit(0)
    })
    .catch((err) => {
      console.error('[llm] falha:', (err as Error).message)
      process.exit(1)
    })
}
