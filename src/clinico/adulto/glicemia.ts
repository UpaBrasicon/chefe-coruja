import { fichaAdulto } from './fonte.ts'

// Emergências hiperglicêmicas (cap. 64, p. 864–876) e hipoglicemia (cap. 65,
// p. 877–881) do Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022).
// Onde o texto e os fluxogramas do capítulo divergem, a ferramenta segue o
// texto e mostra a divergência (DIVERGENCIAS_CAD). A decisão é do profissional.

export const fichaCadEhhAvaliacao = fichaAdulto('adulto-cad-ehh-avaliacao', 'CAD e EHH — critérios e fórmulas', 'cap. 64, p. 864–865, 869, 871–873; ânion-gap no cap. 69, p. 935')
export const fichaCadEhhTratamento = fichaAdulto('adulto-cad-ehh-tratamento', 'CAD e EHH — hidratação, insulina, potássio e bicarbonato', 'cap. 64, p. 869–876; bicarbonato também no cap. 69, p. 938')
export const fichaHipoglicemia = fichaAdulto('adulto-hipoglicemia', 'Hipoglicemia — limiar e doses', 'cap. 65, p. 877–881')

const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x))
const positivo = (...xs: number[]) => ok(...xs) && xs.every((x) => x > 0)

// ---------------------------------------------------------------- fórmulas

/** Ânion-gap = Na − (HCO3 + Cl) (cap. 69, p. 935). */
export function anionGap(na: number, cl: number, hco3: number): number | null {
  if (!positivo(na, cl) || !ok(hco3) || hco3 < 0) return null
  return na - (cl + hco3)
}

/**
 * Osmolaridade efetiva como o manual escreve na p. 869: 2 × Na corrigido +
 * glicemia/18 (o traço de fração do livro abrange o numerador inteiro — ver errata).
 */
export function osmolaridadeEfetiva(naCorrigido: number, glicemia: number): number | null {
  if (!positivo(naCorrigido, glicemia)) return null
  return 2 * naCorrigido + glicemia / 18
}

export const ERRATA_OSMOLARIDADE =
  'Na p. 869 o traço de fração põe "2 × (Na corrigido) + glicemia" inteiro sobre 18, o que daria ~17 mOsm. A conta divide só a glicemia por 18. O manual usa o Na CORRIGIDO nesta fórmula; como a correção já soma o efeito da glicose, o valor sai maior que com o Na medido — ponto a revisar pelo responsável técnico.'

// ---------------------------------------------------------------- critérios

export type CriteriosCad = { glicemia: boolean; ph: boolean; cetose: boolean | null; preenche: boolean | null }

/** CAD: glicemia > 250, pH arterial < 7,3 e cetonemia (ou cetonúria fortemente positiva) (p. 864). */
export function criteriosCad(glicemia: number, ph: number, cetose: boolean | null): CriteriosCad | null {
  if (!positivo(glicemia, ph)) return null
  const g = glicemia > 250
  const p = ph < 7.3
  return { glicemia: g, ph: p, cetose, preenche: cetose === null ? (g && p ? null : false) : g && p && cetose }
}

export type CriteriosEhh = { glicemia: boolean; osmolaridade: boolean; ph: boolean; preenche: boolean }

/** EHH: glicemia > 600, osmolaridade > 320 e pH arterial > 7,3 (p. 864). */
export function criteriosEhh(glicemia: number, osm: number, ph: number): CriteriosEhh | null {
  if (!positivo(glicemia, osm, ph)) return null
  const r = { glicemia: glicemia > 600, osmolaridade: osm > 320, ph: ph > 7.3 }
  return { ...r, preenche: r.glicemia && r.osmolaridade && r.ph }
}

export type Gravidade = 'leve' | 'moderada' | 'grave'

/** Tabela 1 (p. 864–865), pelo pH: leve 7,25–7,30; moderada 7,00–7,24; grave < 7,00. */
export function gravidadePorPh(ph: number): Gravidade | null {
  if (!positivo(ph) || ph > 7.3) return null
  if (ph >= 7.25) return 'leve'
  if (ph >= 7) return 'moderada'
  return 'grave'
}

/** Tabela 1 (p. 865), pelo bicarbonato: leve 15–18; moderada 10–14,9; grave < 10 mEq/L. */
export function gravidadePorBicarbonato(hco3: number): Gravidade | null {
  if (!ok(hco3) || hco3 < 0 || hco3 > 18) return null
  if (hco3 >= 15) return 'leve'
  if (hco3 >= 10) return 'moderada'
  return 'grave'
}

/** Tabela 1 (p. 865): consciência e ânion-gap por gravidade, como o manual traz. */
export const TABELA_GRAVIDADE: Record<Gravidade, { anionGap: string; consciencia: string }> = {
  leve: { anionGap: '> 10', consciencia: 'Alerta' },
  moderada: { anionGap: '> 12', consciencia: 'Alerta ou sonolento' },
  grave: { anionGap: '> 12', consciencia: 'Estupor ou coma' },
}

export type Resolucao = { ph: boolean; anionGap: boolean; bicarbonato: boolean; presentes: number; desligarBomba: boolean }

/** Bomba pode ser desligada com ≥ 2 de 3: pH > 7,3; ânion-gap ≤ 12; bicarbonato ≥ 15 (p. 871–873). */
export function criteriosResolucao(ph: number, ag: number, hco3: number): Resolucao | null {
  if (!positivo(ph) || !ok(ag, hco3)) return null
  const r = { ph: ph > 7.3, anionGap: ag <= 12, bicarbonato: hco3 >= 15 }
  const presentes = Number(r.ph) + Number(r.anionGap) + Number(r.bicarbonato)
  return { ...r, presentes, desligarBomba: presentes >= 2 }
}

// ---------------------------------------------------------------- tratamento

/** Hidratação (p. 869–870; Figuras 2 e 3, p. 872–873). */
export function hidratacao(pesoKg: number) {
  if (!positivo(pesoKg)) return null
  return {
    primeiraHoraMl: [1000, 1500] as [number, number], // texto, p. 869
    primeiraHoraPorPesoMl: [15 * pesoKg, 20 * pesoKg] as [number, number], // 15–20 mL/kg, Figuras 2–3
    segundaFaseMlH: [250, 500] as [number, number], // p. 869
    segundaFasePorPesoMlH: [4 * pesoKg, 14 * pesoKg] as [number, number], // 4–14 mL/kg/h, Figuras 2–3
  }
}

/** 2ª fase: Na < 135 → salina 0,9%; normal ou aumentado → 0,45% (p. 869; as figuras usam o sódio corrigido). */
export const solucaoSegundaFase = (na: number): '0,9%' | '0,45%' | null => (positivo(na) ? (na < 135 ? '0,9%' : '0,45%') : null)

/** Seringa/bolsa do manual: 50 U de insulina regular em 250 mL de SF → 0,2 U/mL; 5 mL = 1 U (p. 871). */
export const INSULINA_BOMBA = { unidades: 50, volumeMl: 250, pagina: 'p. 871' }
export const concentracaoInsulina = () => INSULINA_BOMBA.unidades / INSULINA_BOMBA.volumeMl
export const mlHDeInsulina = (uH: number) => (ok(uH) && uH >= 0 ? uH / concentracaoInsulina() : null)

export type EsquemaInsulina = 'com-bolus' | 'sem-bolus'

/** Bolus 0,1 U/kg + 0,1 U/kg/h, ou 0,14 U/kg/h sem bolus (p. 871). */
export function insulinaInicial(pesoKg: number, esquema: EsquemaInsulina) {
  if (!positivo(pesoKg)) return null
  const uKgH = esquema === 'com-bolus' ? 0.1 : 0.14
  const uH = uKgH * pesoKg
  return { bolusU: esquema === 'com-bolus' ? 0.1 * pesoKg : 0, uKgH, uH, mlH: mlHDeInsulina(uH)! }
}

/** Dose reduzida que as Figuras 2 e 3 citam ao chegar à glicemia-alvo: 0,05 U/kg/h (p. 872–873). */
export function insulinaReduzida(pesoKg: number) {
  if (!positivo(pesoKg)) return null
  const uH = 0.05 * pesoKg
  return { uH, mlH: mlHDeInsulina(uH)! }
}

export type AjusteInsulina = { queda: number; acao: 'dobrar' | 'metade' | 'manter'; novaUH: number }

/** Queda esperada 50–70 mg/dL/h: < 50 → dobrar a taxa; > 70 → reduzir pela metade (p. 871). */
export function ajusteInsulina(glicemiaHoraAnterior: number, glicemiaAtual: number, taxaUH: number): AjusteInsulina | null {
  if (!positivo(glicemiaHoraAnterior, glicemiaAtual, taxaUH)) return null
  const queda = glicemiaHoraAnterior - glicemiaAtual
  if (queda < 50) return { queda, acao: 'dobrar', novaUH: taxaUH * 2 }
  if (queda > 70) return { queda, acao: 'metade', novaUH: taxaUH / 2 }
  return { queda, acao: 'manter', novaUH: taxaUH }
}

export type FaixaPotassio = 'baixo' | 'intermediario' | 'alto'

/** Potássio (p. 871 e 874): < 3,3 / 3,3–5,0 / > 5 mEq/L. */
export function faixaPotassio(k: number): FaixaPotassio | null {
  if (!positivo(k)) return null
  if (k < 3.3) return 'baixo'
  if (k <= 5) return 'intermediario'
  return 'alto'
}

export const POTASSIO_MANUAL: Record<FaixaPotassio, string[]> = {
  baixo: ['Repor 25 mEq de potássio (1 ampola de KCl 19,1% de 10 mL) em 1 L de NaCl 0,9% e repetir a dosagem de K', 'Só se inicia a insulina após K > 3,3 mEq/L'],
  intermediario: ['25 mEq de potássio a cada litro de solução de hidratação', 'Dosar K a cada 2 ou 4 horas'],
  alto: ['Só se inicia a reposição de K quando os valores forem < 5 mEq/L'],
}

/** Bicarbonato só com pH < 6,9: 100 mEq EV em 2 h, gasometria após 1–2 h (p. 874); preparo 100 mL de NaHCO3 8,4% + 400 mL de AD (p. 938). */
export function bicarbonato(ph: number) {
  if (!positivo(ph)) return null
  const preparoMl = 100 + 400
  return { indicado: ph < 6.9, meq: 100, horas: 2, preparoMl, mlH: preparoMl / 2 }
}

/** Sistema de 2 bolsas (Tabela 5, p. 870): bolsa 1 SF + KCl 40 mEq/L; bolsa 2 SG 10% + KCl 40 mEq/L. */
export function duasBolsas(totalMlH: number, glicoseFinalPct: number) {
  if (!positivo(totalMlH) || !ok(glicoseFinalPct) || glicoseFinalPct < 0 || glicoseFinalPct > 10) return null
  const bolsa2 = (totalMlH * glicoseFinalPct) / 10
  return { bolsa1: totalMlH - bolsa2, bolsa2 }
}

/** Transição para SC: 2/3 da insulina das últimas 24 h, ou 0,6 U/kg de NPH (p. 874). */
export function transicaoSc(insulina24hU: number, pesoKg: number) {
  return {
    doisTercos: positivo(insulina24hU) ? (insulina24hU * 2) / 3 : null,
    nphPorPeso: positivo(pesoKg) ? 0.6 * pesoKg : null,
  }
}

export const DIVERGENCIAS_CAD: { tema: string; texto: string; figura: string }[] = [
  { tema: 'Insulina sem bolus', texto: '0,14 U/kg/h (p. 871)', figura: '"0,14 U/kg" sem o /h (Figuras 2 e 3, p. 872–873)' },
  { tema: 'Queda de glicemia insuficiente', texto: '< 50 mg/dL/h → dobrar a taxa (p. 871; também na Figura 3)', figura: 'Figura 2 (CAD): deve cair 10%/h; se cair menos, bolus de 0,15 U/kg EV' },
  { tema: 'Quando associar glicose', texto: 'glicemia 250–300 mg/dL (p. 870)', figura: '200 mg/dL na Figura 2 (CAD), 250 mg/dL na Figura 3 (EHH), 200–300 na Tabela 6 (p. 875)' },
  { tema: 'Potássio alto', texto: '> 5 mEq/L (p. 874; Figura 3)', figura: '> 5,2 mEq/L na Figura 2' },
  { tema: 'Potássio baixo', texto: '25 mEq em 1 L de SF (p. 874)', figura: '20 a 30 mEq IV em 1 h (Figuras 2 e 3)' },
  { tema: 'Bicarbonato', texto: 'pH < 6,9 (p. 874 e p. 938)', figura: 'pH ≤ 6,9 e repetir a cada 2 h até pH > 7,0 (Figura 2)' },
  { tema: 'Hidratação na 2ª fase', texto: '250–500 mL (4 mL/kg) por hora (p. 869)', figura: '250 a 500 mL/h (4–14 mL/kg/h) (Figuras 2 e 3)' },
  { tema: 'NPH na transição', texto: '0,6 U/kg (p. 874)', figura: '0,5–0,8 U/kg em 2 doses (Figura 2)' },
  { tema: 'Desligar a bomba', texto: '≥ 1 h após a primeira insulina regular SC (p. 874)', figura: '1 a 2 h após (Figuras 2 e 3)' },
]

// ---------------------------------------------------------------- hipoglicemia

/** Limiar: < 45 mg/dL sem DM (texto, p. 877) — a Figura 1 (p. 881) usa < 50; < 70 mg/dL com DM (p. 877 e 881). */
export const LIMIAR_HIPOGLICEMIA = { semDmTexto: 45, semDmFigura: 50, comDm: 70 }

export function abaixoDoLimiar(glicemia: number, diabetico: boolean): boolean | null {
  if (!ok(glicemia) || glicemia < 0) return null
  return glicemia < (diabetico ? LIMIAR_HIPOGLICEMIA.comDm : LIMIAR_HIPOGLICEMIA.semDmTexto)
}

/** Doses do manual (p. 880): glicose 50% 60–100 mL; glucagon 1–2 mg IM; tiamina 100 mg IV ou IM. */
export const HIPOGLICEMIA_DOSES = {
  glicose50Ml: [60, 100] as [number, number],
  glucagonMg: [1, 2] as [number, number],
  tiaminaMg: 100,
  observacaoHoras: [12, 24] as [number, number],
}

/** Gramas de glicose no volume de glicose a 50% (0,5 g/mL). */
export const gramasGlicose50 = (ml: number) => (ok(ml) && ml >= 0 ? ml * 0.5 : null)
