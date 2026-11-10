// Validade do item da prescrição (lacuna 6; decisão do RT em 10/11/2026, A em
// V1 a V9; migration 20270327000001).
//
// A regra é da Resolução COFEN 689/2022, art. 4º: a enfermagem não executa
// prescrição fora da validade, e no serviço hospitalar a validade é de 24 h.
// O servidor grava a validade (valida_ate) e calcula o estado
// (private.validade_item); a checagem e a dispensação recusam o vencido.
// Aqui só se mostra: o selo, o texto da impressão e a lista da renovação.
import { diaMes, hora } from './formato.ts'

/** "11/11 14:00" (dia, mês e hora no fuso de Brasília). */
export const diaHora = (iso: string) => `${diaMes(iso)} ${hora(iso)}`

export type Validade = 'sem_prazo' | 'em_dia' | 'vence_logo' | 'vencido'

/** A janela do aviso antes do vencimento (a mesma do servidor). */
export const JANELA_RENOVACAO_MS = 2 * 60 * 60 * 1000

export const FONTE_VALIDADE = 'Resolução COFEN 689/2022, art. 4º: prescrição vale 24 h no serviço hospitalar.'

/** O motivo que o servidor grava na versão renovada sem mudança. */
export const MOTIVO_RENOVACAO = 'Renovada sem mudança'

/** O que vem das RPCs (fila_checagem, prescricao_vigente, prescricao_porta_ativa, painel do PS). */
export type ComValidade = { valida_ate?: string | null; validade?: string | null }

/** O estado como o servidor calcula, pelo relógio da tela (para o selo andar sem recarregar). */
export function estadoValidade(validaAte: string | null | undefined, agora: number): Validade {
  if (!validaAte) return 'sem_prazo'
  const fim = Date.parse(validaAte)
  if (Number.isNaN(fim)) return 'sem_prazo'
  if (agora >= fim) return 'vencido'
  if (agora >= fim - JANELA_RENOVACAO_MS) return 'vence_logo'
  return 'em_dia'
}

/** O estado do item: o do relógio da tela, sem nunca voltar atrás do servidor (vencido fica vencido). */
export function validadeDoItem(i: ComValidade, agora: number): Validade {
  const local = estadoValidade(i.valida_ate, agora)
  return i.validade === 'vencido' ? 'vencido' : local
}

/** "40 min", "1h20". */
export function faltaPara(validaAte: string, agora: number): string {
  const min = Math.max(0, Math.ceil((Date.parse(validaAte) - agora) / 60_000))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

export type SeloValidade = { texto: string; tom: 'critico' | 'ambar'; titulo: string }

/** O selo da tela: "Vencido, peça renovação" ou "Vence em 1h20"; em dia ou sem prazo, nada. */
export function seloValidade(i: ComValidade, agora: number): SeloValidade | null {
  const v = validadeDoItem(i, agora)
  if (!i.valida_ate || (v !== 'vencido' && v !== 'vence_logo')) return null
  const titulo = `Válido até ${diaHora(i.valida_ate)}. ${FONTE_VALIDADE}`
  if (v === 'vencido') return { texto: 'Vencido, peça renovação', tom: 'critico', titulo }
  return { texto: `Vence em ${faltaPara(i.valida_ate, agora)}`, tom: 'ambar', titulo }
}

/** "válido até 11/11 14:00" (folha da prescrição, V9); "Agora" não vence: vazio. */
export function textoValidoAte(validaAte: string | null | undefined): string {
  return validaAte ? `válido até ${diaHora(validaAte)}` : ''
}

type ItemRenovavel = ComValidade & { tipo: string }

/** Itens que entram na tela "Renovar prescrição": vencendo (2 h) ou vencidos; sem "Agora" e sem contenção (V7). */
export function paraRenovar<T extends ItemRenovavel>(itens: readonly T[], agora: number): T[] {
  return itens.filter((i) => i.tipo !== 'contencao' && ['vence_logo', 'vencido'].includes(validadeDoItem(i, agora)))
}

/** Resumo do paciente (leito, PS da enfermagem): quantos vencidos, quantos vencendo e o próximo vencimento. */
export function resumoValidade(itens: readonly ItemRenovavel[], agora: number): { vencidos: number; vencendo: number; proximo: string | null } {
  let vencidos = 0
  let vencendo = 0
  let proximo: string | null = null
  for (const i of itens) {
    if (i.tipo === 'contencao') continue
    const v = validadeDoItem(i, agora)
    if (v === 'vencido') vencidos++
    else if (v === 'vence_logo') {
      vencendo++
      if (i.valida_ate && (!proximo || Date.parse(i.valida_ate) < Date.parse(proximo))) proximo = i.valida_ate
    }
  }
  return { vencidos, vencendo, proximo }
}

/** Texto do resumo: "2 itens vencidos", "1 item vence em 40 min". Nada a dizer: null. */
export function textoResumoValidade(r: { vencidos: number; vencendo: number; proximo: string | null }, agora: number): SeloValidade | null {
  const fonte = FONTE_VALIDADE
  if (r.vencidos) {
    return { texto: `Prescrição vencida: ${r.vencidos} ${r.vencidos === 1 ? 'item' : 'itens'}`, tom: 'critico', titulo: fonte }
  }
  if (r.vencendo && r.proximo) {
    return {
      texto: `Prescrição vence em ${faltaPara(r.proximo, agora)}${r.vencendo > 1 ? ` (${r.vencendo} itens)` : ''}`,
      tom: 'ambar', titulo: `Primeiro vencimento às ${diaHora(r.proximo)}. ${fonte}`,
    }
  }
  return null
}

/** A versão nova veio da renovação sem mudança (não é alteração). */
export const ehRenovacao = (motivo: string | null | undefined) => motivo === MOTIVO_RENOVACAO

export type AcaoRenovacao = 'manter' | 'alterar' | 'suspender'
export type DecisaoRenovacao = {
  acao: AcaoRenovacao | null
  motivo: string
  mudancas: { dose: string; via: string; posologia: string; se_necessario: boolean }
}

/** O que falta para confirmar a renovação; vazio = pode confirmar. Cada item precisa da sua marca. */
export function faltaNaRenovacao(decisoes: readonly { descricao: string; tipo: string; d: DecisaoRenovacao; mudou: boolean }[]): string[] {
  const falta: string[] = []
  for (const { descricao, tipo, d, mudou } of decisoes) {
    if (!d.acao) falta.push(`${descricao}: marque manter, alterar ou suspender`)
    else if (d.acao === 'alterar' && tipo !== 'medicamento') falta.push(`${descricao}: cuidado não se altera; suspenda e prescreva de novo`)
    else if (d.acao === 'alterar' && !mudou) falta.push(`${descricao}: diga o que muda`)
    else if (d.acao !== 'manter' && d.motivo.trim().length < 5) falta.push(`${descricao}: diga o motivo`)
  }
  return falta
}

/** O corpo de renovar_prescricao. */
export function decisoesParaServidor(lista: readonly { id: string; d: DecisaoRenovacao }[]) {
  return lista.map(({ id, d }) => ({
    item_id: id,
    acao: d.acao,
    ...(d.acao === 'alterar' ? { mudancas: { ...d.mudancas, dose: d.mudancas.dose.trim(), posologia: d.mudancas.posologia.trim() } } : {}),
    ...(d.acao !== 'manter' ? { motivo: d.motivo.trim() } : {}),
  }))
}
