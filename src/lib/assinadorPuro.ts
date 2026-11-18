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
