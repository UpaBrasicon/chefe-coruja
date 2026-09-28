import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Emergências hiperglicêmicas (cap. 64, p. 864–876) e hipoglicemia (cap. 65,
// p. 877–881) do Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022).
// Onde o texto e os fluxogramas do capítulo divergem, a ferramenta segue o
// texto e mostra a divergência (DIVERGENCIAS_CAD). A decisão é do profissional.
//
// Versão .1 de 28/09/2026: ao lado do livro entra o consenso ADA/EASD/JBDS/
// AACE/DTS de 2024 (Diabetes Care 2024;47:1257–1275), lido no texto: critérios
// novos de CAD e EHH, gravidade, resolução, fluido, insulina, potássio,
// bicarbonato e transição (CONSENSO_2024 e DIFERENCAS_2024). O manual continua
// como base; as diferenças aparecem lado a lado.

export const CONSENSO_2024: Fonte = {
  citacao: 'Umpierrez GE, Davis GM, ElSayed NA, et al. Hyperglycemic Crises in Adults With Diabetes: A Consensus Report (ADA, EASD, JBDS, AACE, DTS). Diabetes Care. 2024;47(8):1257–1275.',
  url: 'https://doi.org/10.2337/dci24-0032',
}

const PAG_AVALIACAO = 'cap. 64, p. 864–865, 869, 871–873; ânion-gap no cap. 69, p. 935'
const PAG_TRATAMENTO = 'cap. 64, p. 869–876; bicarbonato também no cap. 69, p. 938'

export const fichaCadEhhAvaliacao: Ficha = {
  ...fichaAdulto('adulto-cad-ehh-avaliacao', 'CAD e EHH — critérios e fórmulas', PAG_AVALIACAO),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_AVALIACAO), { ...CONSENSO_2024, citacao: `${CONSENSO_2024.citacao} Critérios (Fig. 2, p. 1262), gravidade (Tabela 2, p. 1263), resolução (Fig. 4, p. 1264).` }],
  revisadoEm: '28/09/2026 (consenso 2024 conferido no texto; manual do HC mantido como base)',
}
export const fichaCadEhhTratamento: Ficha = {
  ...fichaAdulto('adulto-cad-ehh-tratamento', 'CAD e EHH — hidratação, insulina, potássio e bicarbonato', PAG_TRATAMENTO),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_TRATAMENTO), { ...CONSENSO_2024, citacao: `${CONSENSO_2024.citacao} Fig. 4 (p. 1264), fluidos e insulina (p. 1265–1266), potássio e bicarbonato (p. 1266), transição (p. 1264–1265).` }],
  revisadoEm: '28/09/2026 (consenso 2024 conferido no texto; manual do HC mantido como base)',
}
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

// ---------------------------------------------------------------- consenso ADA/EASD 2024
// Páginas citadas são as do periódico (Diabetes Care 2024;47:1257–1275).

/** Osmolalidade efetiva como o consenso escreve (Fig. 2B, p. 1262): 2 × Na MEDIDO + glicose em mmol/L (mg/dL ÷ 18). */
export function osmolalidadeEfetiva2024(naMedido: number, glicemiaMgDl: number): number | null {
  if (!positivo(naMedido, glicemiaMgDl)) return null
  return 2 * naMedido + glicemiaMgDl / 18
}

export type EntradaCad2024 = { glicemia: number; dmPrevio: boolean; bhb?: number; cetonuria2mais?: boolean | null; ph: number; hco3: number }
export type CriteriosCad2024 = { hiperglicemiaOuDm: boolean; cetose: boolean | null; acidose: boolean; preenche: boolean | null; euglicemica: boolean }

/**
 * CAD pelo consenso 2024 (Fig. 2A, p. 1262): glicose ≥ 200 mg/dL OU diabetes prévio;
 * β-hidroxibutirato ≥ 3,0 mmol/L OU cetonúria 2+ ou mais; pH < 7,3 E/OU bicarbonato < 18 mmol/L.
 * CAD euglicêmica (p. 1262): glicose < 200 com cetose e acidose.
 */
export function criteriosCad2024(e: EntradaCad2024): CriteriosCad2024 | null {
  if (!positivo(e.glicemia, e.ph) || !ok(e.hco3) || e.hco3 < 0) return null
  const hiperglicemiaOuDm = e.glicemia >= 200 || e.dmPrevio
  const cetose = e.bhb !== undefined && Number.isFinite(e.bhb) ? e.bhb >= 3 : e.cetonuria2mais ?? null
  const acidose = e.ph < 7.3 || e.hco3 < 18
  const preenche = cetose === null ? (hiperglicemiaOuDm && acidose ? null : false) : hiperglicemiaOuDm && cetose && acidose
  return { hiperglicemiaOuDm, cetose, acidose, preenche, euglicemica: preenche === true && e.glicemia < 200 }
}

export type EntradaEhh2024 = { glicemia: number; osmEfetiva: number; osmTotal?: number; bhb?: number; cetonuria2mais?: boolean | null; ph: number; hco3: number }
export type CriteriosEhh2024 = { glicemia: boolean; hiperosmolar: boolean; semCetoseSignificativa: boolean | null; semAcidose: boolean; preenche: boolean | null }

/**
 * EHH pelo consenso 2024 (Fig. 2B, p. 1262), os quatro juntos: glicose ≥ 600 mg/dL;
 * osmolalidade efetiva > 300 mOsm/kg OU total > 320; BHB < 3,0 OU cetonúria < 2+; pH ≥ 7,3 E bicarbonato ≥ 15.
 * A alteração do sensório deixou de ser critério.
 */
export function criteriosEhh2024(e: EntradaEhh2024): CriteriosEhh2024 | null {
  if (!positivo(e.glicemia, e.osmEfetiva, e.ph) || !ok(e.hco3)) return null
  const glicemia = e.glicemia >= 600
  const hiperosmolar = e.osmEfetiva > 300 || (e.osmTotal !== undefined && Number.isFinite(e.osmTotal) && e.osmTotal > 320)
  const semCetoseSignificativa = e.bhb !== undefined && Number.isFinite(e.bhb) ? e.bhb < 3 : e.cetonuria2mais === null || e.cetonuria2mais === undefined ? null : !e.cetonuria2mais
  const semAcidose = e.ph >= 7.3 && e.hco3 >= 15
  const preenche = semCetoseSignificativa === null ? (glicemia && hiperosmolar && semAcidose ? null : false) : glicemia && hiperosmolar && semCetoseSignificativa && semAcidose
  return { glicemia, hiperosmolar, semCetoseSignificativa, semAcidose, preenche }
}

/** Tabela 2 (p. 1263): gravidade por cada parâmetro; "nem todas as variáveis precisam ser preenchidas" — a tela mostra cada uma. */
export function gravidadeCad2024(e: { bhb?: number; ph?: number; hco3?: number }): { porBhb: Gravidade | null; porPh: Gravidade | null; porHco3: Gravidade | null; pior: Gravidade | null } {
  const ordem: Gravidade[] = ['leve', 'moderada', 'grave']
  const porBhb = e.bhb !== undefined && Number.isFinite(e.bhb) && e.bhb >= 3 ? (e.bhb > 6 ? 'grave' : 'leve') : null // 3,0–6,0 cobre leve e moderada; > 6,0 grave
  const porPh = e.ph !== undefined && positivo(e.ph) && e.ph < 7.3 ? (e.ph < 7 ? 'grave' : e.ph <= 7.25 ? 'moderada' : 'leve') : null
  const porHco3 = e.hco3 !== undefined && ok(e.hco3) && e.hco3 >= 0 && e.hco3 < 18 ? (e.hco3 < 10 ? 'grave' : e.hco3 < 15 ? 'moderada' : 'leve') : null
  const presentes = [porBhb, porPh, porHco3].filter((g): g is Gravidade => g !== null)
  const pior = presentes.length ? ordem[Math.max(...presentes.map((g) => ordem.indexOf(g)))] : null
  return { porBhb, porPh, porHco3, pior }
}

/** Resolução da CAD (Fig. 4, p. 1264): pH venoso > 7,3 OU bicarbonato > 18 mmol/L, E cetonas < 0,6 mmol/L. */
export function resolucaoCad2024(phVenoso: number, hco3: number, cetonaMmol: number): { acidoBase: boolean; cetona: boolean; resolvida: boolean } | null {
  if (!positivo(phVenoso) || !ok(hco3, cetonaMmol) || hco3 < 0 || cetonaMmol < 0) return null
  const acidoBase = phVenoso > 7.3 || hco3 > 18
  const cetona = cetonaMmol < 0.6
  return { acidoBase, cetona, resolvida: acidoBase && cetona }
}

/** Resolução do EHH (Fig. 4, p. 1264): osmolalidade < 300 mOsm/kg, diurese > 0,5 mL/kg/h e glicose < 250 mg/dL. */
export function resolucaoEhh2024(osm: number, diureseMlKgH: number, glicemia: number): { osm: boolean; diurese: boolean; glicemia: boolean; resolvido: boolean } | null {
  if (!positivo(osm, glicemia) || !ok(diureseMlKgH) || diureseMlKgH < 0) return null
  const r = { osm: osm < 300, diurese: diureseMlKgH > 0.5, glicemia: glicemia < 250 }
  return { ...r, resolvido: r.osm && r.diurese && r.glicemia }
}

/** Tratamento pelo consenso 2024, com a página do periódico. */
export const TRATAMENTO_2024 = {
  fluido: {
    mlH: [500, 1000] as [number, number],
    horas: [2, 4] as [number, number],
    texto: 'SF 0,9% ou cristaloide balanceado a 500–1.000 mL/h nas primeiras 2–4 h (sem comprometimento renal ou cardíaco); depois, conforme hidratação, PA, diurese e eletrólitos; repor 50% do déficit estimado em 8–12 h',
    fragil: 'Idoso, insuficiência cardíaca ou doença renal terminal em diálise: bolus menores (p. ex., 250 mL) com reavaliação hemodinâmica frequente',
    pagina: 'p. 1264–1265',
  },
  glicose: { limiar: 250, texto: 'Glicose < 250 mg/dL: acrescentar dextrose 5–10% ao cristaloide; CAD euglicêmica (glicose < 200 com BHB positivo): dextrose desde o início da insulina', pagina: 'p. 1264–1265' },
  insulina: {
    uKgH: 0.1,
    bolusSoSeAtraso: 0.1,
    reduzidaUKgH: 0.05,
    ehhUKgH: 0.05,
    ehhAlvoGlicose: [200, 250] as [number, number],
    texto: 'Infusão IV de insulina regular a 0,1 U/kg/h em taxa fixa (moderada/grave); bolus de 0,1 U/kg só se houver atraso para montar a infusão; glicose < 250 → 0,05 U/kg/h. CAD leve: análogo rápido SC 0,1 U/kg em bolus e depois 0,1 U/kg a cada 1 h ou 0,2 U/kg a cada 2 h. EHH: 0,05 U/kg/h, alvo de glicose 200–250 mg/dL até resolver; CAD/EHH misto (BHB ≥ 3, pH < 7,30 ou HCO₃ < 18): 0,1 U/kg/h',
    pagina: 'Fig. 4, p. 1264; p. 1265–1266',
  },
  potassio: {
    baixo: 3.5,
    alto: 5.0,
    texto: {
      baixo: 'K < 3,5 mmol/L: repor 10–20 mmol/h até K > 3,5 ANTES de iniciar a insulina (reposição mais rápida exige acesso central)',
      medio: 'K 3,5–5,0 mmol/L: iniciar a insulina e dar 10–20 mmol por litro de fluido para manter K entre 4 e 5; dosar a cada 2 h',
      alto: 'K > 5,0 mmol/L: não repor; dosar a cada 2 h',
    },
    pagina: 'Fig. 4, p. 1264; p. 1266',
  },
  bicarbonato: { phLimiar: 7.0, texto: 'Só com pH < 7,0: 100 mmol de NaHCO₃ 8,4% em 400 mL de água estéril (isotônica) a cada 2 h até pH > 7,0', pagina: 'p. 1264 e 1266' },
  fosfato: { texto: 'Só com fraqueza muscular ou comprometimento respiratório e fósforo < 1,0 mmol/L', pagina: 'Fig. 4, p. 1264' },
  monitorizacao: { texto: 'Glicemia capilar a cada 1–2 h; sangue a cada 4 h (eletrólitos, fósforo, creatinina, BHB, pH venoso) até a resolução; no EHH, osmolalidade também a cada 4 h', pagina: 'p. 1264' },
  ehh: {
    quedaGlicoseMax: [90, 120] as [number, number],
    quedaNaMax24h: 10,
    quedaOsm: [3, 8] as [number, number],
    texto: 'EHH: queda da glicose ≤ 90–120 mg/dL/h (edema cerebral), do sódio ≤ 10 mmol/L em 24 h e da osmolalidade entre 3,0 e 8,0 mOsm/kg/h',
    pagina: 'p. 1265 e 1268',
  },
  transicao: { ivAposScH: [1, 2] as [number, number], basalUKg: [0.15, 0.3] as [number, number], texto: 'Manter a infusão IV por 1–2 h após a insulina SC; nos recém-diagnosticados, basal SC 0,15–0,3 U/kg (1 ou 2 doses) com rápida às refeições', pagina: 'p. 1264–1265' },
}

/** Insulina pelo consenso: taxa fixa 0,1 U/kg/h, dose reduzida 0,05, EHH 0,05, na bomba do manual (0,2 U/mL). */
export function insulina2024(pesoKg: number) {
  if (!positivo(pesoKg)) return null
  const uH = TRATAMENTO_2024.insulina.uKgH * pesoKg
  const reduzidaUH = TRATAMENTO_2024.insulina.reduzidaUKgH * pesoKg
  return { uH, mlH: mlHDeInsulina(uH)!, bolusSeAtrasoU: TRATAMENTO_2024.insulina.bolusSoSeAtraso * pesoKg, reduzidaUH, reduzidaMlH: mlHDeInsulina(reduzidaUH)!, ehhUH: reduzidaUH }
}

export type FaixaPotassio2024 = 'baixo' | 'medio' | 'alto'

/** Potássio pelo consenso 2024 (Fig. 4, p. 1264): < 3,5 / 3,5–5,0 / > 5,0 mmol/L (o manual usa 3,3 e 5,0). */
export function potassio2024(k: number): FaixaPotassio2024 | null {
  if (!positivo(k)) return null
  if (k < TRATAMENTO_2024.potassio.baixo) return 'baixo'
  if (k <= TRATAMENTO_2024.potassio.alto) return 'medio'
  return 'alto'
}

/** Bicarbonato pelo consenso 2024: só pH < 7,0 (o manual usa < 6,9). */
export const bicarbonato2024 = (ph: number) => (positivo(ph) ? ph < TRATAMENTO_2024.bicarbonato.phLimiar : null)

/** Fluido pelo consenso (p. 1264–1265): 500–1.000 mL/h nas primeiras 2–4 h; frágil: bolus de 250 mL. */
export const fluido2024 = () => ({ mlH: TRATAMENTO_2024.fluido.mlH, totalEm2a4h: [TRATAMENTO_2024.fluido.mlH[0] * 2, TRATAMENTO_2024.fluido.mlH[1] * 4] as [number, number], bolusFragilMl: 250 })

/** Onde o consenso 2024 muda o que o manual traz. */
export const DIFERENCAS_2024: { tema: string; manual: string; consenso: string }[] = [
  { tema: 'Glicemia no critério de CAD', manual: '> 250 mg/dL (p. 864)', consenso: '≥ 200 mg/dL OU diabetes prévio, qualquer glicemia (Fig. 2A, p. 1262); ~10% das CAD são euglicêmicas (< 200)' },
  { tema: 'Cetose', manual: 'cetonemia ou cetonúria fortemente positiva (p. 864)', consenso: 'β-hidroxibutirato ≥ 3,0 mmol/L OU cetonúria 2+ ou mais; dosagem direta de BHB recomendada (p. 1262)' },
  { tema: 'Acidose', manual: 'pH arterial < 7,3 (p. 864)', consenso: 'pH < 7,3 E/OU bicarbonato < 18 mmol/L; o ânion-gap sai do diagnóstico e da resolução (Fig. 2A, p. 1262)' },
  { tema: 'EHH', manual: 'glicemia > 600, osmolaridade > 320 (com Na corrigido) e pH > 7,3 (p. 864, 869)', consenso: 'glicose ≥ 600; osmolalidade efetiva > 300 mOsm/kg (2 × Na medido + glicose em mmol/L) OU total > 320; BHB < 3,0; pH ≥ 7,3 E HCO₃ ≥ 15; sensório deixa de ser critério (Fig. 2B, p. 1262)' },
  { tema: 'Gravidade da CAD', manual: 'pH e HCO₃ da Tabela 1 (p. 864–865)', consenso: 'pH e HCO₃ com os mesmos cortes, mais BHB 3,0–6,0 (leve/moderada) e > 6,0 (grave); não é preciso preencher todas as variáveis (Tabela 2, p. 1263)' },
  { tema: 'Resolução da CAD', manual: '2 de 3: pH > 7,3, AG ≤ 12, HCO₃ ≥ 15 (p. 871–873)', consenso: 'pH venoso > 7,3 OU HCO₃ > 18, E cetona < 0,6 mmol/L (Fig. 4, p. 1264)' },
  { tema: 'Hidratação inicial', manual: '1.000–1.500 mL na 1ª hora (15–20 mL/kg), depois 250–500 mL/h (p. 869)', consenso: '500–1.000 mL/h nas primeiras 2–4 h; 50% do déficit em 8–12 h; frágil: bolus de 250 mL (p. 1264–1265)' },
  { tema: 'Bolus de insulina', manual: 'bolus 0,1 U/kg + 0,1 U/kg/h, ou 0,14 U/kg/h sem bolus (p. 871)', consenso: '0,1 U/kg/h fixa sem bolus; bolus de 0,1 U/kg só se houver atraso na infusão; CAD leve pode ser SC (Fig. 4, p. 1264)' },
  { tema: 'Quando reduzir a insulina e associar glicose', manual: 'glicemia 250–300 mg/dL (p. 870; figuras 200/250)', consenso: 'glicose < 250 mg/dL → 0,05 U/kg/h + dextrose 5–10% (Fig. 4, p. 1264)' },
  { tema: 'Potássio', manual: '< 3,3 → repor antes; 3,3–5,0 → 25 mEq/L; > 5 → não repor (p. 871, 874)', consenso: '< 3,5 → 10–20 mmol/h antes da insulina; 3,5–5,0 → 10–20 mmol/L; > 5,0 → não repor (Fig. 4, p. 1264)' },
  { tema: 'Bicarbonato', manual: 'só pH < 6,9: 100 mEq em 2 h (p. 874)', consenso: 'só pH < 7,0: 100 mmol em 400 mL a cada 2 h até pH > 7,0 (p. 1266)' },
  { tema: 'Fosfato', manual: 'disfunção cardíaca, fraqueza, rabdomiólise/anemia ou P < 1,0 (p. 874)', consenso: 'só fraqueza muscular ou comprometimento respiratório com P < 1,0 mmol/L (Fig. 4, p. 1264)' },
  { tema: 'Transição para SC', manual: '2/3 da insulina de 24 h ou NPH 0,6 U/kg; bomba ≥ 1 h após a SC (p. 874)', consenso: 'manter IV 1–2 h após a SC; basal 0,15–0,3 U/kg nos recém-diagnosticados (p. 1264–1265)' },
  { tema: 'EHH: velocidade de correção', manual: '—', consenso: 'glicose ≤ 90–120 mg/dL/h; Na ≤ 10 mmol/L/24 h; osmolalidade 3–8 mOsm/kg/h (p. 1265, 1268)' },
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
