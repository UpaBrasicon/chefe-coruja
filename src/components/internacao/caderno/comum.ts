// Peças comuns do caderno do leito: tipos do que o banco devolve, formatação
// de hora e o chamador de RPC.
import { supabase } from '@/lib/supabase'

export type Internacao = {
  id: string
  status: string
  data_admissao: string
  data_alta: string | null
  alta_registrada_em: string | null
  alta_por: string | null
  cid_alta: string | null
  cid_principal: string | null
  episodio_id: string | null
  leito: { identificador: string } | null
  setor_atual_id: string | null
  /** episódio da porta que originou a internação: a cor da classificação */
  episodio: { cor_atual: string | null; queixa: string | null } | null
}

export type Phoenix = {
  total: number
  cardiovascular: number
  sepse: boolean
  choque: boolean
  itens: { sistema: string; pontos: number; maximo: number; detalhe: string }[]
  faltando: string[]
  parcial: boolean
  gatilho: { motivo: 'cid' | 'suspeita'; cid?: string; descricao: string }
  fonte: string
  notas: string
}

export type Acuidade = {
  escala: 'NEWS2' | 'PEWS' | null
  motivo?: string
  total?: number
  banda?: 0 | 1 | 2
  itens?: { rotulo: string; valor: string; pontos: number; azul?: boolean }[]
  faltando?: string[]
  azul?: string[]
  parcial?: boolean
  grupo?: string
  fonte?: string
  aferido_em?: string | null
  phoenix?: Phoenix
  pelod2?: {
    indicado: boolean
    referencia_carregada: boolean
    total: number
    completo: boolean
    mortalidade_prevista: number
    itens: { grupo: string; rotulo: string; valor: string | number | null; pontos: number }[]
    faltando: string[]
    fonte: string
    notas: string
  }
}

export type Pendencia = {
  id: string
  tipo: string
  descricao: string
  prazo: string | null
  impeditiva: boolean
  situacao: string
  criada_em: string
  autor_id: string | null
  resolvida_por: string | null
  resolvida_em: string | null
}

export type Passagem = {
  id: string
  de_perfil: string
  para_perfil: string
  resumo: string
  situacao: string
  enviada_em: string
  motivo_recusa: string | null
}

export type Pacote = { id: string; situacao: string; criado_em: string; expira_em: string; tentativas: number }

export const ATIVO = ['admitido', 'em_observacao', 'internado']

export const TIPO_PENDENCIA: Record<string, string> = {
  observacao: 'Observação',
  reavaliacao: 'Reavaliação',
  exame: 'Exame',
  parecer: 'Parecer',
  regulacao: 'Regulação',
  outro: 'Outro',
}
export const TIPO_ALTA = [
  ['alta_melhorada', 'Alta melhorada'],
  ['alta_pedido', 'Alta a pedido'],
  ['alta_evasao', 'Evasão'],
  ['transferencia_externa', 'Transferência externa'],
  ['obito', 'Óbito'],
] as const
export const ROTULO_ALTA: Record<string, string> = Object.fromEntries(TIPO_ALTA)

export const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—'
export const diaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '—'
export const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

/** "45 min", "5h", "3 dias" desde o instante. */
export function tempoDesde(desde: string, agora: number) {
  const min = Math.max(0, Math.round((agora - Date.parse(desde)) / 60_000))
  if (min < 60) return `${min} min`
  if (min < 24 * 60) return `${Math.floor(min / 60)}h`
  const dias = Math.floor(min / 1440)
  return dias === 1 ? '1 dia' : `${dias} dias`
}

export type Acao = <T>(fn: () => Promise<T>, ok?: string) => Promise<T | null>

export const rpc = async (nome: string, args: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(nome as any, args as any)
  if (error) throw error
  return (data ?? true) as unknown
}

