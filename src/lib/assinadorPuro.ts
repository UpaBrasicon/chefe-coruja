// LG7: partes puras da assinatura no app (testáveis sem o cliente do Supabase).
import { hora } from './formato.ts'

/**
 * Tipos assinados com ICP-Brasil (decisão A1 do RT): o que sai para o paciente
 * ou para outro serviço. Espelho de TIPO_SAUDE em services/assinador/src/fluxo.ts
 * (um teste confere que são iguais). Evolução e prescrição do internado ficam
 * com o login e o 2FA.
 */
export const TIPOS_ASSINAVEIS = new Set(['receita', 'atestado', 'pedido_exames', 'encaminhamento', 'sumario_alta', 'documento_transferencia', 'laudo_aih', 'teleinterconsulta'])

export type SessaoAssinatura = {
  ativa: boolean
  provedor: string | null
  valida_ate: string | null
  provedores: { id: string; nome: string }[]
}

/** Quanto o navegador espera o assinador (pedido 18, F7): as chamadas da sessão. */
export const PRAZO_ASSINADOR_MS = 20_000
/**
 * A assinatura espera o assinador inteiro (Supabase, folha em PDF e provedor,
 * cada um com prazo próprio lá dentro); a emissão não espera por ela.
 */
export const PRAZO_ASSINAR_MS = 90_000
export const ASSINADOR_SEM_RESPOSTA = 'O assinador não respondeu a tempo. Tente de novo em instantes.'

/**
 * Chama o assinador com prazo. Estourou: erro com status 504 e texto claro.
 * Sem nova tentativa: quem chama decide (a assinatura nunca repete sozinha).
 */
export async function pedirAoAssinador<T>(f: typeof fetch, url: string, init: RequestInit, prazoMs: number): Promise<T> {
  const signal = AbortSignal.timeout(prazoMs)
  const semResposta = () => Object.assign(new Error(ASSINADOR_SEM_RESPOSTA), { status: 504 })
  let r: Response
  try {
    r = await f(url, { ...init, signal })
  } catch (e) {
    if (signal.aborted) throw semResposta()
    throw e
  }
  if (r.status === 204) return undefined as T
  const corpo = (await r.json().catch(() => {
    if (signal.aborted) throw semResposta()
    return {}
  })) as { erro?: string }
  if (!r.ok) throw Object.assign(new Error(corpo.erro ?? `Assinador: HTTP ${r.status}`), { status: r.status })
  return corpo as T
}

/** bytea do PostgREST (\x… em hexadecimal) → bytes. */
export function bytesDoBytea(v: string): Uint8Array {
  const hex = v.startsWith('\\x') ? v.slice(2) : v
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Texto curto da sessão para a tela. */
export function textoDaSessao(s: Pick<SessaoAssinatura, 'ativa' | 'valida_ate'> | undefined, agora = new Date()): string {
  if (!s?.ativa || !s.valida_ate) return 'Sem sessão de assinatura. Os documentos saem emitidos, sem assinatura ICP-Brasil.'
  const ate = new Date(s.valida_ate)
  if (ate <= agora) return 'A sessão de assinatura terminou. Abra outra para assinar.'
  return `Assinatura ICP-Brasil ativa até as ${hora(ate)}. Os documentos emitidos saem assinados.`
}
