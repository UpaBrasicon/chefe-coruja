// Prescrição do leito numa lista só (PR1, revisão da Internação aprovada pelo
// RT em 24/11/2026): os itens agrupados pela situação — vencidos (e vencendo
// em até 2 h) primeiro, depois os ativos do leito, os vindos da porta e, por
// último, os suspensos (recolhidos). A regra da validade continua a de
// validadePrescricao (COFEN 689/2022); aqui só se separa para mostrar.
import { paraRenovar, type ComValidade } from './validadePrescricao.ts'

type Item = ComValidade & { id: string; tipo: string }

export type GruposPrescricao<T extends Item> = {
  /** vencidos e vencendo (leito e porta), na ordem de paraRenovar; daPorta marca a origem */
  vencidos: (T & { daPorta: boolean })[]
  ativos: T[]
  porta: T[]
}

export function gruposDaPrescricao<T extends Item>(leito: readonly T[], porta: readonly T[], agora: number): GruposPrescricao<T> {
  const todos = [...leito.map((i) => ({ ...i, daPorta: false })), ...porta.map((i) => ({ ...i, daPorta: true }))]
  const vencidos = paraRenovar(todos, agora)
  const ids = new Set(vencidos.map((i) => i.id))
  return {
    vencidos,
    ativos: leito.filter((i) => !ids.has(i.id)),
    porta: porta.filter((i) => !ids.has(i.id)),
  }
}

/** Título do grupo de renovação: "Vencidos" ou "Vencidos e vencendo", conforme o que há. */
export function tituloRenovacao(nVencidos: number, nTotal: number): string {
  if (nVencidos === 0) return 'Vencendo em até 2 horas'
  return nVencidos === nTotal ? 'Vencidos' : 'Vencidos e vencendo'
}

/** O que mostrar da diluição na linha: só quando existe (PR3); sem diluição publicada, nada. */
export function textoDiluicao(i: { diluicao_texto: string | null; diluicao_versao: number | null; diluicao_divergente: boolean; justificativa_divergencia: string | null }):
  { texto: string; fora: boolean } | null {
  if (i.diluicao_divergente) return { texto: `Diluição fora do padrão: ${i.diluicao_texto ?? ''} — justificativa: ${i.justificativa_divergencia ?? ''}`, fora: true }
  if (i.diluicao_texto) return { texto: `Diluição padrão v${i.diluicao_versao ?? '?'}: ${i.diluicao_texto}`, fora: false }
  return null
}

export type OpcaoNovoItem =
  | { tipo: 'cuidado'; rotulo: string }
  | { tipo: 'contencao'; rotulo: string }

/**
 * Busca única do "Novo item" (PR3): além dos medicamentos (que vêm do
 * servidor), os cuidados da lista que casam com o termo, o cuidado escrito
 * como está e a contenção mecânica. Sem dose em nada.
 */
export function opcoesSemMedicamento(termo: string, cuidados: readonly string[]): OpcaoNovoItem[] {
  const t = sem(termo)
  if (t.length < 2) return []
  const out: OpcaoNovoItem[] = cuidados.filter((c) => sem(c).includes(t)).map((c) => ({ tipo: 'cuidado' as const, rotulo: c }))
  if (!cuidados.some((c) => sem(c) === t)) out.push({ tipo: 'cuidado', rotulo: termo.trim() })
  if ('contencao mecanica'.includes(t) || t.startsWith('conten')) out.push({ tipo: 'contencao', rotulo: 'Contenção mecânica' })
  return out
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
