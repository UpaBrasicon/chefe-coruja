import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Anafilaxia do adulto — cap. 11 do Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022), p. 175–179. Só a parte do adulto: as doses
// pediátricas por kg que o capítulo cita (corticoides e magnésio) não são
// implementadas aqui. A ferramenta mostra o que o manual traz e faz as contas
// de diluição, volume e velocidade (ADR 0007).
//
// Versão .1 de 25/10/2026 (lacunas da Central, lote 3): critérios da WAO 2020
// (texto completo, PMC7607509) e o Practice Parameter 2023 da AAAAI/ACAAI (PDF
// da versão aceita, p. 1–53, enviado pelo RT) ao lado do manual: critérios
// diagnósticos, adrenalina por peso, reação bifásica, observação e triptase.

export const WAO_2020: Fonte = {
  citacao: 'Cardona V, Ansotegui IJ, Ebisawa M, et al. World allergy organization anaphylaxis guidance 2020. World Allergy Organ J. 2020;13(10):100472. Tabela 2 (critérios) e "Management of anaphylaxis" (adrenalina, reação bifásica, observação); texto completo, PMC7607509.',
  url: 'https://doi.org/10.1016/j.waojou.2020.100472',
}

export const PP_ANAFILAXIA_2023: Fonte = {
  citacao: 'Golden DBK, Wang J, Waserman S, et al. Anaphylaxis: A 2023 practice parameter update. Ann Allergy Asthma Immunol. 2024;132(2):124–176. Lido na versão aceita (p. 1–53): Tabela 3, recomendações 2 e 6 (p. 7); Box 1, itens 4 a 7 (p. 9); triptase (p. 3 e 16).',
  url: 'https://doi.org/10.1016/j.anai.2023.09.015',
}

const PAG_ANAF = 'cap. 11 Anafilaxia, p. 175–179'

export const fichaAnafilaxiaAdulto: Ficha = {
  ...fichaAdulto('adulto-anafilaxia', 'Anafilaxia — adulto', PAG_ANAF),
  versao: '2026-10-25.1',
  fontes: [pagina(PAG_ANAF), WAO_2020, PP_ANAFILAXIA_2023],
  revisadoEm: '25/10/2026 (lacunas da Central, lote 3: WAO 2020 e Practice Parameter 2023; manual mantido como base)',
}

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

// ── WAO 2020 e Practice Parameter 2023 ───────────────────────────────────────

export type AchadosWao = {
  /** início agudo (minutos a horas) com pele ou mucosa acometida */
  pele: boolean
  respiratorio: boolean
  /** PA reduzida ou sintoma de disfunção de órgão-alvo (hipotonia, síncope, incontinência) */
  pa: boolean
  /** gastrointestinal grave (cólica intensa, vômitos repetidos), sobretudo com alérgeno não alimentar */
  gi: boolean
  /** exposição a alérgeno conhecido ou muito provável para o paciente */
  alergeno: boolean
  hipotensao: boolean
  broncoespasmo: boolean
  laringe: boolean
}

export type LeituraWao = { provavel: boolean; criterio: 1 | 2 | null }

/**
 * WAO 2020, Tabela 2: anafilaxia é muito provável com (1) pele/mucosa mais
 * respiratório, PA/órgão-alvo ou GI grave; ou (2) hipotensão, broncoespasmo ou
 * acometimento laríngeo após alérgeno conhecido ou muito provável, mesmo sem pele.
 */
export function criteriosWao2020(a: AchadosWao): LeituraWao {
  if (a.pele && (a.respiratorio || a.pa || a.gi)) return { provavel: true, criterio: 1 }
  if (a.alergeno && (a.hipotensao || a.broncoespasmo || a.laringe)) return { provavel: true, criterio: 2 }
  return { provavel: false, criterio: null }
}

/** Hipotensão na WAO 2020 (nota a da Tabela 2), adulto e acima de 10 anos: PAS < 90 ou queda > 30% do basal. */
export function hipotensaoWao(pas: number, pasBasal?: number): boolean | null {
  if (!Number.isFinite(pas) || pas <= 0) return null
  if (pas < 90) return true
  return pasBasal !== undefined && Number.isFinite(pasBasal) && pasBasal > 0 ? pas < pasBasal * 0.7 : false
}

/** WAO 2020: adrenalina IM 0,01 mg/kg, máximo 0,5 mg, repetida a cada 5–15 min se refratária. */
export const ADRENALINA_IM_WAO = { mgKg: 0.01, maximoMg: 0.5, repeticaoMin: [5, 15] as Faixa }

export function adrenalinaImWaoMg(pesoKg: number): { mg: number; noMaximo: boolean } | null {
  if (!valido(pesoKg)) return null
  const bruto = ADRENALINA_IM_WAO.mgKg * pesoKg
  return { mg: Math.min(bruto, ADRENALINA_IM_WAO.maximoMg), noMaximo: bruto > ADRENALINA_IM_WAO.maximoMg }
}

/**
 * Practice Parameter 2023 (p. 3 e 16): triptase aguda de pelo menos 20% + 2 ng/mL
 * acima da basal (1,2 × basal + 2) é evidência de ativação mastocitária sistêmica.
 */
export function triptaseLimiar(basalNgMl: number): number | null {
  return Number.isFinite(basalNgMl) && basalNgMl >= 0 ? 1.2 * basalNgMl + 2 : null
}

export type ItemDiretriz = { tema: string; texto: string; onde: string; livro: string }

export const DIRETRIZES_ANAFILAXIA: ItemDiretriz[] = [
  { tema: 'Critério e adrenalina', texto: 'Não é preciso preencher critério diagnóstico antes de dar adrenalina; nem a decisão de dar nem a resposta a ela confirmam o diagnóstico (condicional, muito baixa)', onde: 'PP 2023, recomendações 6 e 7, p. 7', livro: '—' },
  { tema: 'Adrenalina IM', texto: '0,01 mg/kg, máximo 0,5 mg, repetida a cada 5–15 min se refratária; a via EV não é recomendada no tratamento inicial', onde: 'WAO 2020', livro: '0,3–0,5 mg a cada 5–10 min (p. 175)' },
  { tema: 'Reação bifásica', texto: 'Muito provável quando a anafilaxia volta em até 48 h, sem nova exposição, depois de pelo menos 1 h sem sintomas. Cerca de metade ocorre nas primeiras 6–12 h. Mais provável com anafilaxia grave e com mais de uma dose de adrenalina', onde: 'PP 2023, Box 1, itens 4 e 5, p. 9; WAO 2020', livro: '—' },
  { tema: 'Observação', texto: 'Bifásica improvável se a anafilaxia não foi grave e o paciente fica 1 h sem sintomas em observação após a resolução. A WAO diz que não há consenso sobre o tempo; observar sobretudo nas reações graves e com várias doses de adrenalina', onde: 'PP 2023, Box 1, item 5, p. 9; WAO 2020', livro: '4 h após o tratamento, se assintomático (p. 177)' },
  { tema: 'Persistente e refratária', texto: 'Persistente: dura pelo menos 4 h. Refratária: continua apesar de adrenalina adequada e tratamento dos sintomas (ex.: volume na hipotensão), com mais risco de morte', onde: 'PP 2023, Box 1, itens 6–7, p. 9', livro: '—' },
  { tema: 'Triptase', texto: 'Colher o quanto antes, idealmente até 2 h do início, e repetir depois como basal (condicional, moderada). Elevação de pelo menos 20% + 2 ng/mL sobre a basal sugere ativação mastocitária', onde: 'PP 2023, recomendação 2, p. 7; p. 3 e 16', livro: '—' },
  { tema: 'Corticoide', texto: 'Há cada vez mais evidência de que não traz benefício na fase aguda, podendo até prejudicar; o uso de rotina é controverso', onde: 'WAO 2020', livro: 'hidrocortisona 200–300 mg; metilprednisolona até 125 mg (p. 177)' },
]

/** Icatibanto: 30 mg por injeção, no máximo 3 injeções (p. 179). */
export const ICATIBANTO = { mg: 30, intervaloH: 6, maxInjecoes: 3, pagina: 'p. 179' }
export const icatibantoMaxMg = () => ICATIBANTO.mg * ICATIBANTO.maxInjecoes
