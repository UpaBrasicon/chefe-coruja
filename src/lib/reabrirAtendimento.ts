// Reabrir o atendimento da porta depois do desfecho (lacuna 8; decisão do RT
// em 10/11/2026, A em R1 a R10). Formato de public.reabrir_atendimento_previa e
// public.reabrir_atendimento (migration 20270330000001) e as regras que a tela
// usa para mostrar o botão e o aviso. Quem decide é o servidor: a tela só
// esconde o botão de quem não vai conseguir.

import { rotuloDesfechoFinal } from './historico.ts'

export const MOTIVOS_REABERTURA = [
  { valor: 'erro_registro', rotulo: 'Erro de registro' },
  { valor: 'paciente_voltou', rotulo: 'Paciente voltou' },
  { valor: 'desfecho_errado', rotulo: 'Desfecho errado' },
  { valor: 'outro', rotulo: 'Outro' },
] as const
export type MotivoReabertura = (typeof MOTIVOS_REABERTURA)[number]['valor']

export const rotuloMotivoReabertura = (v: string | null | undefined) =>
  MOTIVOS_REABERTURA.find((m) => m.valor === v)?.rotulo ?? (v ?? '')

/** Mínimo de letras do detalhe quando o motivo é "outro" (igual ao banco). */
export const DETALHE_MINIMO = 10
export const DETALHE_MAXIMO = 500

/** Motivo escolhido e, no "outro", o detalhe com 10 letras ou mais. */
export function motivoReaberturaValido(motivo: string | null, detalhe: string): boolean {
  if (!motivo || !MOTIVOS_REABERTURA.some((m) => m.valor === motivo)) return false
  const d = detalhe.trim()
  if (d.length > DETALHE_MAXIMO) return false
  return motivo !== 'outro' || d.length >= DETALHE_MINIMO
}

/** Desfechos da porta que reabrem (R4); a transferência o servidor ainda confere com a regulação. */
export const DESFECHOS_QUE_REABREM = new Set(['alta', 'alta_apos_medicacao', 'alta_a_pedido', 'evasao', 'transferencia'])
export const PRAZO_REABRIR_MS = 24 * 60 * 60 * 1000

export type SaidaParaReabrir = {
  desfecho: string | null
  desfecho_por: string | null
  desfecho_em: string | null
  encerrado_em: string | null
}

/** O botão "Reabrir" aparece para o autor do desfecho ou o gestor, até 24 h depois (R1, R2, R9). */
export function podeVerReabrir(s: SaidaParaReabrir, quem: { perfilId: string | null | undefined; ehGestor: boolean }, agora: number): boolean {
  if (!s.desfecho || !DESFECHOS_QUE_REABREM.has(s.desfecho) || !s.desfecho_por) return false
  if (!(quem.ehGestor || (!!quem.perfilId && s.desfecho_por === quem.perfilId))) return false
  const desde = Date.parse(s.encerrado_em ?? s.desfecho_em ?? '')
  return Number.isFinite(desde) && agora - desde < PRAZO_REABRIR_MS
}

// ── a prévia e a resposta ───────────────────────────────────────────────────

export type ItemReabertura = { id: string; descricao: string; motivo?: 'vencido' | 'contencao' }
export type DocumentoReabertura = { id: string; tipo_documento: string; numero: string | null; emitido_em: string }
export type ImpactoReabertura = {
  itens_voltam: ItemReabertura[]
  itens_nao_voltam: ItemReabertura[]
  exames_cancelados: { id: string; exame: string }[]
  pareceres_cancelados: { id: string; especialidade: string }[]
  isolamentos_encerrados: { id: string; tipo: string }[]
  contencoes_encerradas: { id: string }[]
  documentos: DocumentoReabertura[]
  rac_enviado: boolean
  contrarreferencias: number
}
export type PreviaReabertura =
  | { pode: false; recusa: string }
  | ({ pode: true; recusa: null; desfecho: string; desfecho_em: string; prazo_ate: string } & ImpactoReabertura)

const ISOLAMENTO: Record<string, string> = { contato: 'contato', goticula: 'gotícula', aerossol: 'aerossol' }

/**
 * O que não volta com a reabertura, uma linha por assunto (R6, R7). O rascunho
 * do registro (SOAP) nunca volta; o resto só aparece quando há.
 */
export function avisosReabertura(p: ImpactoReabertura): string[] {
  const linhas: string[] = []
  const lista = (xs: string[]) => xs.join(', ')
  const vencidos = p.itens_nao_voltam.filter((i) => i.motivo !== 'contencao')
  const contencaoItem = p.itens_nao_voltam.filter((i) => i.motivo === 'contencao')
  if (vencidos.length) linhas.push(`Prescrição vencida não volta (fica suspensa): ${lista(vencidos.map((i) => i.descricao))}. Prescreva de novo se precisar.`)
  if (p.contencoes_encerradas.length || contencaoItem.length) linhas.push('A contenção encerrada no desfecho não volta.')
  if (p.exames_cancelados.length) linhas.push(`Exame cancelado não volta: ${lista(p.exames_cancelados.map((x) => x.exame))}. Peça de novo se precisar.`)
  if (p.pareceres_cancelados.length) linhas.push(`Parecer cancelado não volta: ${lista(p.pareceres_cancelados.map((x) => x.especialidade))}. Peça de novo se precisar.`)
  if (p.isolamentos_encerrados.length) {
    linhas.push(`O isolamento encerrado não volta (${lista(p.isolamentos_encerrados.map((x) => ISOLAMENTO[x.tipo] ?? x.tipo))}): a enfermagem marca de novo se precisar.`)
  }
  linhas.push('O rascunho do registro do atendimento não volta.')
  if (p.contrarreferencias > 0) linhas.push('O retorno avisado à UBS é cancelado.')
  if (p.rac_enviado) linhas.push('O registro do atendimento já foi enviado à RNDS: o envio fica como está.')
  return linhas
}

/** "Volta: Cabeceira elevada, Dipirona" ou nulo quando nada volta. */
export function resumoQueVolta(p: Pick<ImpactoReabertura, 'itens_voltam'>): string | null {
  return p.itens_voltam.length ? `Volta a valer: ${p.itens_voltam.map((i) => i.descricao).join(', ')}.` : null
}

// ── o selo "reaberto" ───────────────────────────────────────────────────────

export type ReaberturaResumo = { desfecho_anterior: string | null; criado_em: string }

/** A reabertura mais recente do atendimento, se houve. */
export function ultimaReabertura<T extends ReaberturaResumo>(lista: T[] | null | undefined): T | null {
  if (!lista?.length) return null
  return [...lista].sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em))[0]
}

/** Texto do selo: "Reaberto · antes: Alta". */
export const rotuloReaberto = (r: ReaberturaResumo | null) =>
  r ? `Reaberto · antes: ${rotuloDesfechoFinal(r.desfecho_anterior)}` : null
