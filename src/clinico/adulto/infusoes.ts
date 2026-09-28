import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Infusões contínuas do adulto — Anexo 1 do Manual de Medicina de Emergência
// do HCFMUSP (3ª ed., 2022), p. 1482–1489. A concentração é CALCULADA do
// preparo e a velocidade sai da dose; as tabelas de mL/h do livro não foram
// copiadas (algumas têm linhas trocadas — ver errata de cada item).
//
// Versão .1 de 28/09/2026: atualização focada PADIS 2025 da SCCM (sedação
// contínua), lida pelo resumo executivo e pela página da SCCM — notas ao lado
// do grupo "sedação"; as diluições continuam sendo as do Anexo 1.

export const PADIS_2025: Fonte = {
  citacao: 'Lewis K, Balas MC, Stollings JL, et al. A Focused Update to the Clinical Practice Guidelines for the Prevention and Management of Pain, Anxiety, Agitation/Sedation, Delirium, Immobility, and Sleep Disruption in Adult Patients in the ICU. Crit Care Med. 2025;53(3):e711–e727 (resumo executivo e711–e710 e página da SCCM lidos; texto integral não aberto).',
  url: 'https://doi.org/10.1097/CCM.0000000000006574',
}

const PAG_INFUSOES = 'Anexo 1 — Padrão de diluição de medicações HC – adultos, p. 1482–1489'

export const fichaInfusoesAdulto: Ficha = {
  ...fichaAdulto('adulto-infusoes', 'Infusões contínuas do adulto', PAG_INFUSOES),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_INFUSOES), PADIS_2025],
  revisadoEm: '28/09/2026 (PADIS 2025 conferida pelo resumo; Anexo 1 mantido como base)',
}

/** PADIS 2025 — o que a atualização focada diz sobre sedação contínua e delirium. */
export const NOTAS_PADIS_2025: { tema: string; texto: string; forca: string }[] = [
  { tema: 'Dexmedetomidina × propofol', texto: 'Sugere dexmedetomidina em vez de propofol para sedação do adulto em ventilação mecânica quando sedação leve e/ou redução de delirium são as prioridades (29 ensaios, 3.087 pacientes, quase todos titulados para sedação leve)', forca: 'condicional, evidência moderada' },
  { tema: 'Antipsicótico no delirium', texto: 'Evidência insuficiente para recomendar a favor ou contra antipsicóticos em vez do cuidado usual para tratar o delirium', forca: 'sem recomendação' },
  { tema: 'Benzodiazepínico para ansiedade', texto: 'Evidência insuficiente para recomendar', forca: 'sem recomendação' },
  { tema: 'Melatonina', texto: 'Sugere melatonina em vez de nenhuma melatonina no adulto na UTI (30 ensaios)', forca: 'condicional, evidência baixa' },
  { tema: 'Mobilização', texto: 'Sugere mobilização/reabilitação intensificada em vez da usual', forca: 'condicional, evidência moderada' },
]

export type InfusaoAdulto = {
  id: string
  nome: string
  grupo: 'vasoativo' | 'sedacao' | 'bloqueio'
  /** unidade da dose */
  numerador: 'mcg' | 'mg' | 'U'
  porKg: boolean
  tempo: 'min' | 'h'
  faixa: [number, number]
  /** conteúdo total da droga no preparo, na unidade do numerador */
  totalDroga: number
  volumeFinalMl: number
  preparo: string
  pagina: string
  errata?: string
}

export const INFUSOES_ADULTO: InfusaoAdulto[] = [
  { id: 'noradrenalina', nome: 'Noradrenalina', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.02, 2], totalDroga: 16000, volumeFinalMl: 250,
    preparo: '4 ampolas de 4 mg/4 mL + SG 5% 234 mL (250 mL)', pagina: 'p. 1486–1487',
    errata: 'O livro escreve "4 mg/mL (ampola 4 mL)"; a concentração final de 64 µg/mL só fecha com 4 mg por ampola.' },
  { id: 'adrenalina', nome: 'Adrenalina', grupo: 'vasoativo', numerador: 'mcg', porKg: false, tempo: 'min', faixa: [1, 20], totalDroga: 6000, volumeFinalMl: 100,
    preparo: '6 ampolas de 1 mg/mL + SF 94 mL (100 mL)', pagina: 'p. 1487–1488',
    errata: 'O livro escreve a concentração final como "60 µg/min"; é 60 µg/mL (a dose de 1–20 µg/min corresponde a 1–20 mL/h).' },
  { id: 'dobutamina', nome: 'Dobutamina', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [2, 20], totalDroga: 1_000_000, volumeFinalMl: 250,
    preparo: '4 ampolas de 12,5 mg/mL (20 mL) + SF 170 mL (250 mL)', pagina: 'p. 1487',
    errata: 'Na tabela 16 do livro, a linha "16 µg/kg/min" traz os valores de 14 µg/kg/min.' },
  { id: 'vasopressina', nome: 'Vasopressina', grupo: 'vasoativo', numerador: 'U', porKg: false, tempo: 'min', faixa: [0.01, 0.04], totalDroga: 20, volumeFinalMl: 100,
    preparo: '1 ampola de 20 U/mL + SF 99 mL (100 mL)', pagina: 'p. 1488' },
  { id: 'nitroprussiato', nome: 'Nitroprussiato de sódio', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.5, 10], totalDroga: 50000, volumeFinalMl: 250,
    preparo: '1 ampola de 25 mg/mL (2 mL) + SG 5% 248 mL (250 mL)', pagina: 'p. 1488' },
  { id: 'nitroglicerina', nome: 'Nitroglicerina', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.5, 10], totalDroga: 50000, volumeFinalMl: 250,
    preparo: '1 ampola de 5 mg/mL (10 mL) + SG 5% (250 mL)', pagina: 'p. 1488–1489',
    errata: 'O livro escreve "+ SG 5% 200 mL" com volume final de 250 mL; a concentração de 200 µg/mL exige 240 mL de diluente.' },
  { id: 'milrinona', nome: 'Milrinona', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.375, 0.75], totalDroga: 20000, volumeFinalMl: 100,
    preparo: '20 mg (20 mL de 1 mg/mL) + SF 80 mL (100 mL)', pagina: 'p. 1489',
    errata: 'A tabela 19 do livro é a da nitroglicerina repetida (doses de 0,5 a 10 µg/kg/min, fora da faixa da milrinona).' },
  { id: 'propofol', nome: 'Propofol', grupo: 'sedacao', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [10, 200], totalDroga: 10000, volumeFinalMl: 1,
    preparo: 'puro, 10 mg/mL (ampola 20 mL)', pagina: 'p. 1482–1483' },
  { id: 'midazolam', nome: 'Midazolam', grupo: 'sedacao', numerador: 'mg', porKg: true, tempo: 'h', faixa: [0.05, 0.4], totalDroga: 150, volumeFinalMl: 150,
    preparo: '3 ampolas de 50 mg/10 mL + SF ou SG 5% 120 mL (150 mL)', pagina: 'p. 1483',
    errata: 'O livro escreve "50 mg/mL (ampola 10 mL)"; a concentração final de 1 mg/mL só fecha com 50 mg por ampola (5 mg/mL).' },
  { id: 'dexmedetomidina', nome: 'Dexmedetomidina', grupo: 'sedacao', numerador: 'mcg', porKg: true, tempo: 'h', faixa: [0.2, 1.4], totalDroga: 400, volumeFinalMl: 100,
    preparo: '2 ampolas de 100 µg/mL (2 mL) + SF 96 mL (100 mL)', pagina: 'p. 1483–1484' },
  { id: 'quetamina', nome: 'Quetamina (cetamina)', grupo: 'sedacao', numerador: 'mg', porKg: true, tempo: 'h', faixa: [0.05, 0.4], totalDroga: 100, volumeFinalMl: 100,
    preparo: '1 ampola de 50 mg/mL (2 mL) + SF ou SG 5% 98 mL (100 mL)', pagina: 'p. 1484–1485' },
  { id: 'fentanil', nome: 'Fentanil', grupo: 'sedacao', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.02, 0.07], totalDroga: 50, volumeFinalMl: 1,
    preparo: 'puro, 50 µg/mL (ampola 10 mL)', pagina: 'p. 1485' },
  { id: 'rocuronio', nome: 'Rocurônio', grupo: 'bloqueio', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [8, 12], totalDroga: 10000, volumeFinalMl: 1,
    preparo: 'puro, 10 mg/mL (ampola 5 mL)', pagina: 'p. 1485–1486' },
  { id: 'cisatracurio', nome: 'Cisatracúrio', grupo: 'bloqueio', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [3, 3], totalDroga: 100000, volumeFinalMl: 100,
    preparo: '10 ampolas de 2 mg/mL (5 mL) + SF 50 mL (100 mL)', pagina: 'p. 1486',
    errata: 'Na tabela 14 do livro, a linha "3 µg/kg/min" traz o volume do bolus de 0,15 mg/kg, não a taxa de infusão.' },
]

export const unidadeDose = (i: InfusaoAdulto) => `${i.numerador === 'mcg' ? 'µg' : i.numerador}${i.porKg ? '/kg' : ''}/${i.tempo}`

/** concentração final, na unidade do numerador por mL */
export const concentracao = (i: InfusaoAdulto) => i.totalDroga / i.volumeFinalMl

/** mL/h para uma dose. Drogas por kg exigem peso válido. */
export function velocidadeAdulto(i: InfusaoAdulto, dose: number, pesoKg?: number): number | null {
  if (!Number.isFinite(dose) || dose < 0) return null
  if (i.porKg && (!pesoKg || !Number.isFinite(pesoKg) || pesoKg <= 0)) return null
  const porHora = i.tempo === 'min' ? 60 : 1
  return (dose * (i.porKg ? pesoKg! : 1) * porHora) / concentracao(i)
}

/** Caminho inverso: dose correspondente a uma velocidade em mL/h. */
export function doseAdulto(i: InfusaoAdulto, mlH: number, pesoKg?: number): number | null {
  if (!Number.isFinite(mlH) || mlH < 0) return null
  if (i.porKg && (!pesoKg || !Number.isFinite(pesoKg) || pesoKg <= 0)) return null
  const porHora = i.tempo === 'min' ? 60 : 1
  return (mlH * concentracao(i)) / ((i.porKg ? pesoKg! : 1) * porHora)
}
