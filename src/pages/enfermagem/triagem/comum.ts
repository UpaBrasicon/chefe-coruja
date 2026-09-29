import type { CorRisco } from '@/domain/risco'

// Tipos e utilitários da triagem (fila + classificação).

export type NaFila = {
  id: string
  setor_id: string
  chegada_em: string
  queixa: string
  prioridades_legais: string[]
  paciente: { nome: string; nome_social: string | null; data_nascimento: string | null; sexo: string | null } | null
}

export type Fluxograma = {
  id: string
  nome: string
  publico: 'adulto' | 'pediatrico'
  inclui: string | null
  discriminadores: Partial<Record<CorRisco, [string, string][]>>
}

const FUSO = 'America/Sao_Paulo'
export const dataSP = (d: Date | string = new Date()) => new Date(d).toLocaleDateString('en-CA', { timeZone: FUSO })
export const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })
export const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export const nomeDe = (ep: NaFila) => ep.paciente?.nome_social || ep.paciente?.nome || 'Paciente'
export const ehFeminino = (ep: NaFila) => /^f/i.test(ep.paciente?.sexo ?? '')

/** Minutos desde a chegada (a espera da triagem conta da ficha da recepção). */
export const esperaMin = (chegada: string, agora = Date.now()) => Math.max(0, Math.round((agora - new Date(chegada).getTime()) / 60_000))

/** Chave da sala no aparelho — a mesma que BotaoChamar (components/porta/Chamada.tsx) lê. */
export const chaveSala = (setor: string) => `cc-sala:${setor}:triagem`

export function lerSala(setor: string): string {
  try {
    return localStorage.getItem(chaveSala(setor)) ?? ''
  } catch {
    return ''
  }
}

export function gravarSala(setor: string, sala: string) {
  try {
    localStorage.setItem(chaveSala(setor), sala)
  } catch {
    // sem armazenamento: vale só enquanto a tela estiver aberta
  }
}
