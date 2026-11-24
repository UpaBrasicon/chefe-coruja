// Prazo das chamadas de fora do assinador (pedido 18, F7): o provedor do
// certificado e o Supabase. Sem prazo, um servidor que aceita a conexão e não
// responde deixa o pedido do médico preso para sempre.
//
// Nova tentativa só em consulta (GET), que pode repetir sem efeito. Nunca na
// troca do código OAuth (vale uma vez só) nem na assinatura do hash (assinar
// duas vezes não é inofensivo) nem na folha (registra a impressão).
import { ErroAssinador } from './erros.ts'

/** cada chamada ao provedor do certificado (token, certificados, assinatura) */
export const PRAZO_PROVEDOR_MS = 15_000
/** cada chamada ao Supabase (Auth e PostgREST) */
export const PRAZO_SUPABASE_MS = 10_000
/** a Edge `folha` monta a folha inteira (e pode estar fria): prazo mais folgado */
export const PRAZO_FOLHA_MS = 20_000
/** consulta: 2 tentativas ao todo, a segunda depois de 300 ms */
export const TENTATIVAS_CONSULTA = 2
export const ESPERA_ENTRE_TENTATIVAS_MS = 300

export const STATUS_TRANSITORIOS = new Set([502, 503, 504])

/** Falha passageira sem status próprio para o médico (o servidor responde 500, como antes). */
export class FalhaTransitoria extends Error {
  transitorio = true
}

/**
 * Roda `op` com prazo de `ms`: o sinal vai para o fetch (corta a conexão e a
 * leitura do corpo) e, se o prazo estourar, a chamada rejeita com
 * ErroAssinador 504 e a `mensagem`, mesmo que o fetch ignore o sinal.
 */
export async function comPrazo<T>(ms: number, mensagem: string, op: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const signal = AbortSignal.timeout(ms)
  let aoEstourar = () => {}
  const estouro = new Promise<never>((_, rejeitar) => {
    aoEstourar = () => rejeitar(signal.reason)
    signal.addEventListener('abort', aoEstourar, { once: true })
  })
  try {
    return await Promise.race([op(signal), estouro])
  } catch (e) {
    if (signal.aborted) throw new ErroAssinador(504, mensagem, true)
    throw e
  } finally {
    signal.removeEventListener('abort', aoEstourar)
  }
}

/** Prazo estourado, falha de rede do fetch (TypeError) ou 502/503/504. */
export const repetivel = (e: unknown): boolean =>
  e instanceof TypeError || (typeof e === 'object' && e !== null && (e as { transitorio?: unknown }).transitorio === true)

/** Repete `op` só em falha passageira, com espera dobrando a cada vez. Use só em consulta. */
export async function comNovaTentativa<T>(op: () => Promise<T>, o: { tentativas?: number; esperaMs?: number } = {}): Promise<T> {
  const tentativas = o.tentativas ?? TENTATIVAS_CONSULTA
  const espera = o.esperaMs ?? ESPERA_ENTRE_TENTATIVAS_MS
  for (let i = 1; ; i++) {
    try {
      return await op()
    } catch (e) {
      if (i >= tentativas || !repetivel(e)) throw e
      await new Promise((r) => setTimeout(r, espera * 2 ** (i - 1)))
    }
  }
}
