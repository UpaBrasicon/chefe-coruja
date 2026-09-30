// ─────────────────────────────────────────────────────────────────────────────
// Observação (porte do Bloco 3 do protótipo): a linha que o banco devolve
// (painel_observacao), os estados e desfechos com os rótulos do protótipo, e
// as contas dos dois relógios. O estado vem pronto do servidor; aqui só se
// rotula e se conta tempo.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type LinhaBanco = Database['public']['Functions']['painel_observacao']['Returns'][number]

export type EstadoObservacao = 'nao' | 'atendimento' | 'reavaliacao' | 'encaminhado' | 'finalizado'

export type ProtocoloAberto = {
  id: string
  sigla: string
  nome: string
  versao: string
  fonte: string
  etapas: { texto: string; referencia?: string }[]
  etapa_atual: number
  iniciado_em: string
  iniciado_por: string | null
  historico: { etapa: number; texto: string; em: string; por: string | null }[]
}

export type PassagemDoBox = {
  id: string
  situacao: 'aguardando' | 'aceita' | 'recusada'
  resumo: string
  de_perfil: string
  de_nome: string | null
  para_perfil: string
  para_nome: string | null
  enviada_em: string
  respondida_em: string | null
  motivo_recusa: string | null
}

export type LinhaObservacao = Omit<LinhaBanco, 'estado' | 'protocolo' | 'passagem'> & {
  estado: EstadoObservacao
  protocolo: ProtocoloAberto | null
  passagem: PassagemDoBox | null
}

/** Estados na ordem do protótipo (OBS_ESTADOS), com o tom de cada pílula. */
export const ESTADOS: { id: EstadoObservacao; rotulo: string; classe: string }[] = [
  { id: 'nao', rotulo: 'Não atendido', classe: 'bg-trilha text-tinta-apoio' },
  { id: 'atendimento', rotulo: 'Em atendimento', classe: 'bg-marca/10 text-acao' },
  { id: 'reavaliacao', rotulo: 'Em reavaliação', classe: 'bg-observacao/10 text-observacao' },
  { id: 'encaminhado', rotulo: 'Encaminhado', classe: 'bg-suprimento/10 text-suprimento' },
  { id: 'finalizado', rotulo: 'Finalizado', classe: 'bg-conforme/10 text-conforme' },
]

/** Desfechos do protótipo (DESFECHOS_PS sem "Observação"), com o valor da RPC. */
export const DESFECHOS = [
  ['alta_medica', 'Alta médica'],
  ['alta_apos_medicacao', 'Alta após medicação'],
  ['internacao', 'Internação'],
  ['transferencia', 'Transferência'],
  ['evasao', 'Evasão'],
  ['alta_a_pedido', 'Alta a pedido'],
  ['obito', 'Óbito'],
] as const
export type Desfecho = (typeof DESFECHOS)[number][0]
export const ROTULO_DESFECHO: Record<string, string> = Object.fromEntries(DESFECHOS)

/** Onde o protótipo pede relato de 15 letras, com a pergunta dele. */
export const RELATO_DESFECHO: Partial<Record<Desfecho, string>> = {
  evasao: 'Como e quando foi percebida a evasão',
  alta_a_pedido: 'Riscos explicados e termo assinado',
  obito: 'Circunstâncias do óbito e medidas realizadas',
}

export const LIMITE_MIN = 6 * 60

const fuso = 'America/Sao_Paulo'
export const hhmm = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fuso }) : '—'

/** "4h 05min", "35min". */
export function duracao(min: number) {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`
}

export type Tom = 'conforme' | 'atencao' | 'critico'

/**
 * Relógio da permanência (protótipo, contagemObs): quanto falta para as 6
 * horas (prazo do servidor), a barra de 0 a 100% e o tom — verde, âmbar na
 * última hora, vermelho depois do prazo.
 */
export function relogioPermanencia(entrada: string, prazo: string, agora: number) {
  const decorrido = (agora - Date.parse(entrada)) / 60_000
  const resto = (Date.parse(prazo) - agora) / 60_000
  const total = Math.max(1, (Date.parse(prazo) - Date.parse(entrada)) / 60_000)
  const tom: Tom = resto <= 0 ? 'critico' : resto <= 60 ? 'atencao' : 'conforme'
  return {
    permanencia: duracao(decorrido),
    contagem: resto <= 0 ? `Passou há ${duracao(-resto)}` : `Faltam ${duracao(resto)}`,
    pct: Math.min(100, Math.max(0, Math.round((decorrido / total) * 100))),
    tom,
    acima: resto <= 0,
    decorridoMin: decorrido,
  }
}

/** Relógio da espera até o primeiro registro médico da observação. */
export function relogioEspera(entrada: string, primeiro: string | null, agora: number) {
  if (primeiro) {
    const espera = (Date.parse(primeiro) - Date.parse(entrada)) / 60_000
    return { texto: `Primeiro atendimento às ${hhmm(primeiro)} · esperou ${duracao(espera)}`, aguardando: false }
  }
  return { texto: `Aguardando primeiro atendimento há ${duracao((agora - Date.parse(entrada)) / 60_000)}`, aguardando: true }
}

/** "Reavaliar às 15:40 · em 12 min" ou "· atrasada 5 min". */
export function textoReavaliacao(quando: string, agora: number) {
  const m = Math.round((Date.parse(quando) - agora) / 60_000)
  return { texto: `Reavaliar às ${hhmm(quando)}${m >= 0 ? ` · em ${duracao(m)}` : ` · atrasada ${duracao(-m)}`}`, atrasada: m < 0 }
}

export const TOM_TEXTO: Record<Tom, string> = { conforme: 'text-conforme', atencao: 'text-observacao', critico: 'text-critico' }
export const TOM_BARRA: Record<Tom, string> = { conforme: 'bg-conforme', atencao: 'bg-observacao', critico: 'bg-critico' }

export const msgErro = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

/** Ação do card: roda a RPC; devolve se deu certo (o erro fica no card). */
export type Acao = (fn: () => Promise<unknown>) => Promise<boolean>

/** RPC por nome (as da observação e as de passagem que já existiam). */
export const rpc = async (nome: string, args: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(nome as any, args as any)
  if (error) throw error
  return data as unknown
}
