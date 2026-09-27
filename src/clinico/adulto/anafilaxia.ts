import { fichaAdulto } from './fonte.ts'

// Anafilaxia do adulto — cap. 11 do Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022), p. 175–179. Só a parte do adulto: as doses
// pediátricas por kg que o capítulo cita (corticoides e magnésio) não são
// implementadas aqui. A ferramenta mostra o que o manual traz e faz as contas
// de diluição, volume e velocidade (ADR 0007).

export const fichaAnafilaxiaAdulto = fichaAdulto('adulto-anafilaxia', 'Anafilaxia — adulto', 'cap. 11 Anafilaxia, p. 175–179')

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0

export const ADRENALINA_IM = {
  mg: [0.3, 0.5] as Faixa,
  /** diluição 1:1.000 = 1 mg/mL */
  mgMl: 1,
  repeticaoMin: [5, 10] as Faixa,
  local: 'vasto lateral da coxa',
  pagina: 'p. 175',
}

/** Bolus EV: 1 ampola de 1 mg diluída para 10 mL (1:10.000), aplica-se 1 mL = 0,1 mg, ao longo de 5–10 min (p. 176). */
export const ADRENALINA_BOLUS_EV = {
  mg: 0.1,
  preparo: '1 ampola de 1 mg diluída para 10 mL',
  volumeTotalMl: 10,
  ampolaMg: 1,
  minutos: [5, 10] as Faixa,
  quando: 'sem resposta após duas doses IM, ou choque circulatório',
  pagina: 'p. 176',
}

export const bolusEvMl = () => ADRENALINA_BOLUS_EV.mg / (ADRENALINA_BOLUS_EV.ampolaMg / ADRENALINA_BOLUS_EV.volumeTotalMl)

/** Infusão: adrenalina 1 mg em 500 mL de SG ou SF, a 0,5–2 mL/min, titulando o efeito (p. 176). */
export const ADRENALINA_INFUSAO = {
  mgNoPreparo: 1,
  volumeMl: 500,
  mlMin: [0.5, 2] as Faixa,
  pagina: 'p. 176',
}

/** µg/mL do preparo de infusão (1 mg em 500 mL = 2 µg/mL). */
export const ugMlInfusao = () => (ADRENALINA_INFUSAO.mgNoPreparo * 1000) / ADRENALINA_INFUSAO.volumeMl

export type VelocidadeInfusao = { mlMin: number; mlH: number; ugMin: number; foraDaFaixa: boolean }

/** Converte a velocidade em mL/min do livro para mL/h (bomba) e µg/min. */
export function infusaoPorMlMin(mlMin: number): VelocidadeInfusao | null {
  if (!Number.isFinite(mlMin) || mlMin < 0) return null
  const [a, b] = ADRENALINA_INFUSAO.mlMin
  return { mlMin, mlH: mlMin * 60, ugMin: mlMin * ugMlInfusao(), foraDaFaixa: mlMin < a || mlMin > b }
}

/** Caminho inverso: velocidade da bomba (mL/h) para mL/min e µg/min. */
export function infusaoPorMlH(mlH: number): VelocidadeInfusao | null {
  if (!Number.isFinite(mlH) || mlH < 0) return null
  return infusaoPorMlMin(mlH / 60)
}

/** Volume no choque: 10–20 mL/kg nos primeiros minutos (p. 177). */
export function volumeChoqueMl(pesoKg: number): Faixa | null {
  return valido(pesoKg) ? [10 * pesoKg, 20 * pesoKg] : null
}

export type ItemAnafilaxia = { id: string; nome: string; dose: string; pagina: string; nota?: string }

export const SEGUNDA_LINHA_ANAFILAXIA: ItemAnafilaxia[] = [
  { id: 'hidrocortisona', nome: 'Hidrocortisona', dose: '200 a 300 mg IV', pagina: 'p. 177' },
  { id: 'metilprednisolona', nome: 'Metilprednisolona', dose: 'dose máxima de 125 mg', pagina: 'p. 177',
    nota: 'O capítulo dá a dose por kg só para criança (1–2 mg/kg) e o teto de 125 mg; não traz dose própria do adulto.' },
  { id: 'prednisona', nome: 'Prednisona (na alta)', dose: '40 mg por 3 a 5 dias, se manifestações cutâneas persistentes', pagina: 'p. 177' },
  { id: 'difenidramina', nome: 'Difenidramina', dose: '25 a 50 mg IV', pagina: 'p. 177' },
  { id: 'ranitidina', nome: 'Ranitidina', dose: '50 mg IV', pagina: 'p. 177' },
  { id: 'fenoterol', nome: 'Fenoterol', dose: '100–250 µg inalatório', pagina: 'p. 177' },
  { id: 'ipratropio', nome: 'Ipratrópio', dose: '250–500 µg inalatório', pagina: 'p. 177' },
  { id: 'magnesio', nome: 'Sulfato de magnésio (broncoespasmo grave)', dose: '2 g EV durante 20 a 30 minutos', pagina: 'p. 177' },
  { id: 'glucagon', nome: 'Glucagon (usuário de betabloqueador)', dose: '1 mg IV a cada 5 minutos até resolver a hipotensão, seguido de infusão de 5 a 15 µg/min', pagina: 'p. 177',
    nota: 'Divergência interna: no cap. 15 (p. 229), para intoxicação por betabloqueador, o mesmo livro dá bolus de 5–10 mg e infusão de 1–5 mg/h. Aqui fica o texto do cap. 11.' },
  { id: 'icatibanto', nome: 'Icatibanto (angioedema hereditário)', dose: '30 mg SC, pode ser repetido a cada 6 horas (máximo de 3 injeções = 90 mg)', pagina: 'p. 179' },
]

export const CUIDADOS_ANAFILAXIA = [
  { texto: 'Oxigênio para SatO2 > 90%; fluxo inicial de 8 a 10 L/min até haver oximetria', pagina: 'p. 176' },
  { texto: 'Observação de 4 horas após tratamento, se assintomático, antes da alta', pagina: 'p. 177' },
]

/** Icatibanto: 30 mg por injeção, no máximo 3 injeções (p. 179). */
export const ICATIBANTO = { mg: 30, intervaloH: 6, maxInjecoes: 3, pagina: 'p. 179' }
export const icatibantoMaxMg = () => ICATIBANTO.mg * ICATIBANTO.maxInjecoes
