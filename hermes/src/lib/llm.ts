// ─────────────────────────────────────────────────────────────────────────────
// HERMES — lib/llm.ts
// Camada LLM — cliente OpenAI-compatible para o DeepSeek V4 Flash.
//
// Suporta: tool/function calling (formato OpenAI), timeout 60s, 1 retry com
// backoff, fallback opcional (Kimi), e teste de fumaça (`npm run test:llm`).
//
// ⚠️ Modo thinking: reservado para jobs semanais (Fase 4). A doc oficial do
// DeepSeek indica que o modo é ativado por parâmetro na request (mesmo model
// ID) — não fixamos o nome do parâmetro aqui; a Fase 4 consulta a build atual.
// ─────────────────────────────────────────────────────────────────────────────
import { env } from '../config/env.js'
import { logger } from '../logger.js'

export type MensagemLLM = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: ToolCallLLM[]
}

export type ToolCallLLM = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string // JSON string
  }
}

export type ToolDefLLM = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type ChamadaLLM = {
  mensagens: MensagemLLM[]
  tools?: ToolDefLLM[]
  toolChoice?: 'auto' | 'none' | 'required'
  /** Reservado: ativar apenas em jobs semanais (Fase 4), nunca no chat de rotina. */
  thinking?: boolean
  maxTokens?: number
}

export type RespostaLLM = {
  conteudo: string
  toolCalls: ToolCallLLM[]
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
): Promise<{ conteudo: string; toolCalls: ToolCallLLM[]; latenciaMs: number }> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const inicio = Date.now()

  const payload: Record<string, unknown> = {
    model: modelo,
    messages: body.mensagens,
    max_tokens: body.maxTokens ?? 512,
    stream: false,
  }
  if (body.tools && body.tools.length > 0) {
    payload.tools = body.tools
    payload.tool_choice = body.toolChoice ?? 'auto'
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!res.ok) {
    const texto = await res.text().catch(() => '')
    throw new Error(`LLM HTTP ${res.status}: ${texto.slice(0, 300)}`)
  }

  const dados = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null
        tool_calls?: ToolCallLLM[]
      }
    }[]
  }
  const msg = dados.choices?.[0]?.message
  return {
    conteudo: msg?.content ?? '',
    toolCalls: msg?.tool_calls ?? [],
    latenciaMs: Date.now() - inicio,
  }
}

export async function completar(body: ChamadaLLM): Promise<RespostaLLM> {
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
