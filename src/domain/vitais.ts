// Sinais vitais da triagem e da reclassificação (Fase 2). Obrigatórios:
// PA, FC, FR, temperatura, SpO₂ e dor; na pediatria a PA é opcional (CLAUDE.md).
// Nada aqui marca valor como alterado: a análise é da enfermagem e do médico.

import type { FaixaEtaria } from './idade'

export type Publico = 'adulto' | 'pediatrico'

/**
 * Público dos vitais pela IDADE (nunca pela porta). Sem data de nascimento,
 * vale o pediátrico: a PA fica opcional (há locais sem manguito pediátrico e
 * exigir PA travaria o registro de uma criança); os demais obrigatórios são
 * os mesmos do adulto.
 */
export const publicoDosVitais = (f: FaixaEtaria): Publico => (f === 'adulto' ? 'adulto' : 'pediatrico')

export const VITAIS = [
  { k: 'pressao-arterial-sistolica', rotulo: 'PA sistólica', un: 'mmHg', adulto: true, ped: false },
  { k: 'pressao-arterial-diastolica', rotulo: 'PA diastólica', un: 'mmHg', adulto: true, ped: false },
  { k: 'frequencia-cardiaca', rotulo: 'FC', un: 'bpm', adulto: true, ped: true },
  { k: 'frequencia-respiratoria', rotulo: 'FR', un: 'irpm', adulto: true, ped: true },
  { k: 'temperatura', rotulo: 'Temperatura', un: '°C', adulto: true, ped: true },
  { k: 'saturacao-o2', rotulo: 'SpO₂', un: '%', adulto: true, ped: true },
  { k: 'escala-dor', rotulo: 'Dor (0–10)', un: '', adulto: true, ped: true },
  { k: 'glicemia-capilar', rotulo: 'Glicemia capilar', un: 'mg/dL', adulto: false, ped: false },
  { k: 'peso', rotulo: 'Peso', un: 'kg', adulto: false, ped: false },
] as const

/**
 * Medidas que só algumas telas pedem, nunca obrigatórias. A escuta da UBS pede
 * a altura para o item "peso e altura" do hiperdia (notas C5 e C4; achado
 * F5-T2 do portão da Fase 5). O conceito global 'estatura' é em cm.
 */
export const MEDIDAS_EXTRAS = [
  { k: 'estatura', rotulo: 'Altura', un: 'cm', adulto: false, ped: false },
  // Refinamento da UBS, RF3 (RT, 23/11/2026): só nos sinais vitais da UBS;
  // conceito global 'circunferencia-abdominal' (migration 20270415000033)
  { k: 'circunferencia-abdominal', rotulo: 'Circunferência abdominal', un: 'cm', adulto: false, ped: false },
] as const
export type MedidaExtra = (typeof MEDIDAS_EXTRAS)[number]['k']

const TODAS = [...VITAIS, ...MEDIDAS_EXTRAS]

export const obrigatorio = (v: { adulto: boolean; ped: boolean }, publico: Publico | null) => (publico === 'pediatrico' ? v.ped : v.adulto)

export function faltandoVitais(valores: Record<string, string>, publico: Publico | null) {
  return VITAIS.filter((v) => obrigatorio(v, publico) && !(valores[v.k] ?? '').trim())
}

/** Chave da dor: na triagem ela pode vir da soma de uma escala (NIPS/FLACC). */
export const VITAL_DOR = 'escala-dor'

/** Rótulo do sinal pela chave (para o histórico e para mensagens). */
export const rotuloVital = (k: string) => TODAS.find((v) => v.k === k)?.rotulo ?? k

/** "PA 120/80 · FC 88 bpm · …" — crus, sem marca de alterado (CLAUDE.md). */
export function textoVitais(sinais: Record<string, number> | null | undefined): string {
  if (!sinais) return ''
  const s = sinais['pressao-arterial-sistolica']
  const d = sinais['pressao-arterial-diastolica']
  const partes: string[] = []
  if (s !== undefined || d !== undefined) partes.push(`PA ${s ?? '—'}/${d ?? '—'}`)
  for (const v of TODAS) {
    if (v.k.startsWith('pressao-arterial') || sinais[v.k] === undefined) continue
    partes.push(`${v.rotulo.replace(' (0–10)', '')} ${String(sinais[v.k]).replace('.', ',')}${v.un ? ' ' + v.un : ''}`)
  }
  return partes.join(' · ')
}

/**
 * Os limites que a triagem já conferia (classificar_risco e a tela Triar): dor
 * de 0 a 10 e Glasgow de 3 a 15, inteiros. Valem em todo registro de sinal
 * vital, na tela e no servidor (RT, 25/11/2026; migration 20270426000013). As
 * mensagens são as do servidor.
 *
 * Limites do possível, definidos pelo RT em 25/11/2026 (migration
 * 20270426000016): temperatura de 25 a 45 °C, saturação de 0 a 100 % e
 * frequência cardíaca de 0 a 300 bpm. Fora disso o registro é recusado. Os
 * demais sinais continuam entrando crus.
 */
export function erroDeLimite(k: string, n: number): string | null {
  if (k === VITAL_DOR && (!Number.isInteger(n) || n < 0 || n > 10)) return 'Dor pela escala numérica vai de 0 a 10.'
  if (k === 'glasgow' && (!Number.isInteger(n) || n < 3 || n > 15)) return 'Glasgow vai de 3 a 15.'
  if (k === 'temperatura' && (n < 25 || n > 45)) return 'Temperatura impossível: o registro aceita de 25 a 45 °C.'
  if (k === 'saturacao-o2' && (n < 0 || n > 100)) return 'Saturação impossível: vai de 0 a 100 %.'
  if (k === 'frequencia-cardiaca' && (n < 0 || n > 300)) return 'Frequência cardíaca impossível: o registro aceita de 0 a 300 bpm.'
  return null
}

/**
 * Alerta da temperatura, só texto na tela (RT, 25/11/2026): faixa normal de
 * 36,5 a 37,5 °C; abaixo de 35 °C "hipotermia"; acima de 37,5 °C "febre". Não
 * impede o registro (hipotermia grave real tem de poder ser registrada) e não
 * mexe na cor da classificação, que é da enfermagem.
 */
export function alertaTemperatura(texto: string | null | undefined): 'hipotermia' | 'febre' | null {
  const t = (texto ?? '').trim()
  if (t === '') return null
  const n = Number(t.replace(',', '.'))
  if (Number.isNaN(n) || n < 25 || n > 45) return null
  return n < 35 ? 'hipotermia' : n > 37.5 ? 'febre' : null
}

/** Texto do formulário → números para o servidor. Lança erro com o rótulo do campo. */
export function paraNumeros(valores: Record<string, string>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(valores)
      .filter(([, v]) => v.trim() !== '')
      .map(([k, v]) => {
        const n = Number(v.replace(',', '.'))
        if (Number.isNaN(n)) throw new Error(`Valor inválido em ${rotuloVital(k)}`)
        const limite = erroDeLimite(k, n)
        if (limite) throw new Error(limite)
        return [k, n]
      })
  )
}
