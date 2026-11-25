// Folha de prescrição do leito (modelo do RT, 24/11/2026, PM1 a PM5): uma
// folha só, com linhas numeradas — 01 a dieta, 02 em diante os itens vigentes,
// "PS" os vindos da porta e, por último, a linha em branco do novo item. Aqui
// só o texto e a numeração da folha; a regra (validade, travas, renovação)
// continua no servidor e em validadePrescricao.
import { seloValidade, type ComValidade } from './validadePrescricao.ts'

/** Número da linha na folha: 1 → "01". */
export const numeroLinha = (n: number): string => String(n).padStart(2, '0')

/**
 * Índice da linha em branco do novo item: a dieta é a 01, os itens vêm em
 * seguida; editando, "ED".
 */
export function indiceNovaLinha(nItens: number, editando: boolean): string {
  return editando ? 'ED' : numeroLinha(nItens + 2)
}

/** "1 item vigente", "3 itens vigentes". */
export const textoItensVigentes = (n: number): string => `${n} ${n === 1 ? 'item vigente' : 'itens vigentes'}`

/** A hora mais recente entre os itens (a última mudança da folha), ou null. */
export function ultimaAtualizacao(itens: readonly { criado_em: string }[]): string | null {
  let max: string | null = null
  for (const i of itens) if (i.criado_em && (!max || Date.parse(i.criado_em) > Date.parse(max))) max = i.criado_em
  return max
}

type ItemDaLinha = {
  tipo: string; dose: string | null; via: string | null; posologia: string | null; se_necessario: boolean; peso_kg: number | null
}

/**
 * Segunda linha do item: dose · via · frequência · se necessário · peso ref.
 * O que o médico escreveu, como está (nada se calcula aqui). Cuidado e
 * contenção não têm dose: só o "se necessário", quando houver.
 */
export function linhaPosologia(i: ItemDaLinha): string {
  const partes = i.tipo === 'medicamento' ? [i.dose, i.via, i.posologia] : []
  if (i.se_necessario) partes.push('se necessário')
  if (i.tipo === 'medicamento' && i.peso_kg) partes.push(`peso ref. ${i.peso_kg} kg`)
  return partes.map((p) => (p ?? '').trim()).filter(Boolean).join(' · ')
}

/** Etiqueta do tipo na linha: medicamento não leva etiqueta. */
export function etiquetaTipo(tipo: string): string | null {
  if (tipo === 'cuidado') return 'Cuidado'
  if (tipo === 'contencao') return 'Contenção'
  return null
}

/** Etiqueta da validade na linha ("Vencido" ou "Vence em 1h20"), com o texto longo no título. */
export function etiquetaValidade(i: ComValidade, agora: number): { texto: string; tom: 'critico' | 'atencao'; titulo: string } | null {
  const s = seloValidade(i, agora)
  if (!s) return null
  return s.tom === 'critico'
    ? { texto: 'Vencido', tom: 'critico', titulo: `${s.texto}. ${s.titulo}` }
    : { texto: s.texto, tom: 'atencao', titulo: s.titulo }
}

/**
 * Faixa de vencidos (PM3): só aparece quando há o que renovar. A renovação é
 * sempre item a item ("Revisar e renovar"), nunca tudo num clique.
 */
export function faixaVencidos(nVencidos: number, nVencendo: number): { texto: string; tom: 'critico' | 'atencao' } | null {
  if (nVencidos > 0) {
    return {
      texto: `${nVencidos} ${nVencidos === 1 ? 'item vencido' : 'itens vencidos'} (> 24 h) — a enfermagem não administra itens vencidos`,
      tom: 'critico',
    }
  }
  if (nVencendo > 0) {
    return { texto: `${nVencendo} ${nVencendo === 1 ? 'item vence' : 'itens vencem'} em até 2 h — renove antes de vencer`, tom: 'atencao' }
  }
  return null
}

export type EstadoAlergiaFolha = 'tem' | 'nega' | 'desconhece' | 'nao_registrada'

/**
 * Selo das alergias no cabeçalho da folha, em três tons: atenção (não
 * verificada, não registrada ou não soube informar), seguro (nega) e crítico
 * (tem, com as substâncias). Lista vazia não é "nega".
 */
export function seloAlergiaFolha(estado: EstadoAlergiaFolha | null | undefined, substancias: readonly string[]):
  { texto: string; tom: 'atencao' | 'seguro' | 'critico' } {
  if (estado === 'tem') return { texto: substancias.length ? substancias.join(', ') : 'Tem alergia', tom: 'critico' }
  if (estado === 'nega') return { texto: 'Nega alergias', tom: 'seguro' }
  if (estado === 'desconhece') return { texto: 'Não soube informar', tom: 'atencao' }
  if (estado === 'nao_registrada') return { texto: 'Não registrada', tom: 'atencao' }
  return { texto: 'Não verificada', tom: 'atencao' }
}

/** Ctrl+Enter (ou ⌘+Enter no Mac) prescreve quando o foco está no novo item. */
export const ehAtalhoPrescrever = (e: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean =>
  e.key === 'Enter' && (e.ctrlKey || e.metaKey)

/** Teclas do atalho, para a dica no cabeçalho. */
export const teclasDoAtalho = (mac: boolean): [string, string] => [mac ? '⌘' : 'Ctrl', 'Enter']
