import { faixaTeto, faixaVezes, fichaIcr, positivo } from './fonteIcr.ts'

// Potássio, cálcio, magnésio e fósforo na criança — cap. 54 do Pronto-Socorro
// ICr-HCFMUSP (4ª ed., 2023), p. 543–559. Doses por peso como o livro traz,
// com página; a indicação e a escolha são do profissional (ADR 0007).

export const fichaEletrolitosPed = fichaIcr('ped-eletrolitos', 'Potássio, cálcio, magnésio e fósforo — criança', 'cap. 54, p. 543–559')

export type Dose = {
  id: string
  nome: string
  /** faixa por kg na unidade abaixo */
  porKg: [number, number]
  unidade: string
  maximo?: number
  texto: string
  pagina: string
  errata?: string
  nota?: string
}

export type DoseCalculada = { faixa: [number, number]; noMaximo: boolean }

export function calcularDose(d: Dose, pesoKg: number): DoseCalculada | null {
  if (!positivo(pesoKg)) return null
  const bruta = faixaVezes(d.porKg, pesoKg)
  if (d.maximo === undefined) return { faixa: bruta, noMaximo: false }
  return { faixa: faixaTeto(bruta, d.maximo), noMaximo: bruta[1] > d.maximo }
}

// ---------------------------------------------------------------- apresentações (Tabela 11, p. 558–559)

export const APRESENTACOES = {
  kcl191MeqMl: 2.5,
  gluconatoCa10MgCaMl: 9,
  cloretoCa10MgCaMl: 27,
  sulfMg10MeqMl: 0.8,
  sulfMg20MeqMl: 1.6,
  fosforoOrganicoMgPMl: 31, // 31 mg P = 1 mmol; Na 2 mEq/mL
  bicNa84MeqMl: 1,
}

export const ERRATA_TABELA11 =
  'Tabela 11 (p. 558–559): o gluconato de cálcio 10% está com "9 mg Ca elem/mL – 0,5 mEq/mL" e o cloreto de cálcio 10% com "27 mg Ca elem/mL – 1,5 mEq/mL"; pelo cálcio elementar (20 mg = 1 mEq) seriam ~0,45 e ~1,35 mEq/mL. A ferramenta usa só os mg de cálcio elementar.'

// ---------------------------------------------------------------- potássio

export const LIMIARES_K = {
  hipocalemia: 3.5, // < 3,5 (p. 544)
  hipocalemiaGrave: 2.5, // < 2,5 (p. 544)
  hipercalemia: 5.5, // > 5,5 (p. 546)
  hipercalemiaRN: 6.5, // limite superior pode chegar a 6,5 em recém-nascidos e lactentes jovens (p. 546)
  ecgAcimaDe: 6, // > 6: ECG (p. 548)
  hipercalemiaGrave: 7, // ≥ 7 (p. 548)
}

/** Variação de ~0,4 mEq/L no K para cada 0,1 no pH (p. 543). */
export const K_POR_PH = 0.4

export const K_IV: Dose = {
  id: 'k-iv', nome: 'Potássio EV (hipocalemia grave)', porKg: [0.5, 1], unidade: 'mEq/h',
  texto: '0,5 a 1 mEq/kg/h quando há alteração no ECG, K < 2,5 mEq/L ou sinais clínicos', pagina: 'p. 546',
}

export const K_VO: Dose = {
  id: 'k-vo', nome: 'Potássio por via enteral (casos leves)', porKg: [1, 4], unidade: 'mEq/dia',
  texto: '1 a 4 mEq/kg/dia, divididos em 2 a 4 tomadas', pagina: 'p. 546',
}

/** Concentração máxima de K na solução: 40 mEq/L periférico, 80 mEq/L central (p. 546). */
export const K_CONC_MAX = { periferico: 40, central: 80 }

/** Volume mínimo de solução por hora para uma oferta de K (mEq/h) sem passar da concentração máxima. */
export function volumeMinimoMlH(kMeqH: number, acesso: keyof typeof K_CONC_MAX): number | null {
  if (!positivo(kMeqH)) return null
  return (kMeqH / K_CONC_MAX[acesso]) * 1000
}

/** mL de KCl 19,1% (2,5 mEq/mL) para uma quantidade de K em mEq. */
export const mlKcl191 = (meq: number) => (positivo(meq) ? meq / APRESENTACOES.kcl191MeqMl : null)

/** Tabela 7 — tratamento da hipercalemia (p. 549) e texto da p. 548–549. */
export const HIPERCALEMIA: Dose[] = [
  { id: 'gluconato-ca', nome: 'Gluconato de cálcio 10%', porKg: [0.5, 2], unidade: 'mL', maximo: 20, texto: '0,5 a 2 mL/kg (máx. 20 mL) EV em 5 a 10 min; pode repetir após 5 min se o ECG persistir alterado', pagina: 'p. 549 (texto e Tabela 7)' },
  {
    id: 'cloreto-ca', nome: 'Cloreto de cálcio 10%', porKg: [0.2, 0.2], unidade: 'mL', maximo: 10, texto: '20 mg/kg (máx. 1.000 mg) EV em 5 a 10 min = 0,2 mL/kg da solução a 10%', pagina: 'p. 549 (texto)',
    errata: 'A Tabela 7 (p. 549) traz 0,25 a 0,5 mL/kg (25 a 50 mg/kg), diferente dos 20 mg/kg (máx. 1.000 mg) do texto da mesma página. A conta usa o texto; a faixa da tabela aparece ao lado.',
  },
  { id: 'bic', nome: 'Bicarbonato de sódio', porKg: [1, 2], unidade: 'mEq', texto: '1 a 2 mEq/kg EV em 10 a 15 min', pagina: 'p. 549' },
  { id: 'insulina', nome: 'Solução polarizante — insulina', porKg: [0.1, 0.1], unidade: 'UI', maximo: 10, texto: '0,1 UI/kg (máx. 10 UI) + glicose 0,5 g/kg em 30 min', pagina: 'p. 549' },
  { id: 'glicose-polarizante', nome: 'Solução polarizante — glicose', porKg: [0.5, 0.5], unidade: 'g', texto: 'glicose 0,5 g/kg junto da insulina, em 30 min (o livro não traz máximo para a glicose)', pagina: 'p. 549' },
  { id: 'sorcal', nome: 'Sorcal', porKg: [0.5, 1], unidade: 'g', texto: '0,5 a 1 g/kg VO ou VR a cada 6 h', pagina: 'Tabela 7, p. 549' },
  { id: 'kayexalate', nome: 'Kayexalate', porKg: [1, 1], unidade: 'g', texto: '1 g/kg VO ou VR a cada 6 h', pagina: 'Tabela 7, p. 549' },
  { id: 'furosemida-k', nome: 'Furosemida', porKg: [1, 1], unidade: 'mg', texto: '1 mg/kg EV a cada 6 h', pagina: 'Tabela 7, p. 549' },
]

/** Cloreto de cálcio pela Tabela 7: 0,25 a 0,5 mL/kg (p. 549). */
export const CLORETO_CA_TABELA7: Dose = { id: 'cloreto-ca-tab7', nome: 'Cloreto de cálcio 10% (Tabela 7)', porKg: [0.25, 0.5], unidade: 'mL', texto: '0,25 a 0,5 mL/kg EV em 5 a 10 min', pagina: 'Tabela 7, p. 549' }

// ---------------------------------------------------------------- cálcio

export type FaixaCa = 'prematuro' | 'rnTermo' | 'crianca'

/** Hipocalcemia: < 7 mg/dL no prematuro, < 8 no RN a termo, < 8,8 em crianças e adolescentes (p. 550). */
export const LIMIAR_HIPOCALCEMIA: Record<FaixaCa, number> = { prematuro: 7, rnTermo: 8, crianca: 8.8 }

export function hipocalcemia(caTotal: number, faixa: FaixaCa): boolean | null {
  if (!positivo(caTotal)) return null
  return caTotal < LIMIAR_HIPOCALCEMIA[faixa]
}

export const CORRECAO_ALBUMINA_TEXTO =
  'Regra prática do livro (p. 550): para cada 1 g/dL de alteração na albumina, corrigir o cálcio total em 0,8 mg/dL no mesmo sentido. O livro não traz o valor de albumina de referência, então a ferramenta não calcula o cálcio corrigido; na dúvida, o livro indica dosar o cálcio ionizado (p. 552).'

export const HIPOCALCEMIA: Dose[] = [
  { id: 'gluconato-rapido', nome: 'Gluconato de cálcio 10% — correção rápida', porKg: [0.5, 1], unidade: 'mL', texto: '0,5 a 1 mL/kg em 10 a 30 min, com monitorização cardíaca e acesso calibroso (9 mg de cálcio elementar/mL)', pagina: 'p. 552' },
  { id: 'gluconato-lento', nome: 'Gluconato de cálcio 10% — correção lenta', porKg: [2, 4], unidade: 'mL/dia', texto: '2 a 4 mL/kg/dia ao longo das 24 h seguintes', pagina: 'p. 552' },
]

export const HIPERCALCEMIA: Dose[] = [
  { id: 'sf-hiperca', nome: 'Soro fisiológico (expansão)', porKg: [10, 20], unidade: 'mL', texto: 'SF 10 a 20 mL/kg e/ou soro de manutenção com oferta hídrica 1,5 a 2 vezes a basal', pagina: 'p. 553' },
  { id: 'furosemida-ca', nome: 'Furosemida', porKg: [1, 1], unidade: 'mg', texto: '1 mg/kg (uso prolongado: risco de nefrocalcinose)', pagina: 'p. 553' },
  { id: 'hidrocortisona-ca', nome: 'Hidrocortisona', porKg: [4, 8], unidade: 'mg/dia', texto: '4 a 8 mg/kg/dia EV de 6/6 h (hipercalcemia por aumento da 1,25-hidroxivitamina D)', pagina: 'p. 553' },
  { id: 'prednisona-ca', nome: 'Prednisona', porKg: [1, 2], unidade: 'mg/dia', texto: '1 a 2 mg/kg/dia VO de 6/6 h (hipercalcemia por aumento da 1,25-hidroxivitamina D)', pagina: 'p. 553' },
  { id: 'calcitonina', nome: 'Calcitonina', porKg: [4, 4], unidade: 'UI', texto: '4 UI/kg IM ou SC de 12/12 h (efeito em curto prazo)', pagina: 'p. 553' },
]

export const ERRATA_CALCIO = [
  'p. 552: a Tabela 8 tem o título "Sinais clínicos de hipocalemia", mas descreve os sinais de Chvostek e Trousseau, da hipocalcemia (texto da p. 551).',
  'p. 553: "medidas que podem ser tomadas para reduzir a calemia" está na seção de hipercalcemia; pelo contexto, é a calcemia.',
]

/** Hipercalcemia: oferta hídrica 1,5 a 2 vezes a basal (p. 553) sobre a basal de Holliday-Segar do cap. 77. */
export function ofertaHipercalcemia(basalMlDia: number): [number, number] | null {
  return positivo(basalMlDia) ? [basalMlDia * 1.5, basalMlDia * 2] : null
}

// ---------------------------------------------------------------- magnésio

export const LIMIARES_MG = {
  normal: [1.5, 2.3] as [number, number], // mg/dL (p. 556)
  sintomasAbaixoDe: 0.7, // (p. 556)
  moderada: [0.7, 1] as [number, number], // (p. 557)
  hiperSintomasAcimaDe: 4, // (p. 557–558)
  hiperExtrema: 15, // BAVT e parada (p. 558)
}

export type GrauHipoMg = 'grave' | 'moderada' | 'leve'

/** Grave < 0,7; moderada 0,7–1; leve > 1 mg/dL (p. 557). Acima de 1,5 não é hipomagnesemia (p. 556). */
export function grauHipomagnesemia(mg: number): GrauHipoMg | null {
  if (!positivo(mg) || mg >= LIMIARES_MG.normal[0]) return null
  if (mg < 0.7) return 'grave'
  if (mg <= 1) return 'moderada'
  return 'leve'
}

export const HIPOMAGNESEMIA: Record<GrauHipoMg, Dose> = {
  grave: { id: 'mg-grave', nome: 'Sulfato de magnésio EV (grave ou sintomática)', porKg: [25, 50], unidade: 'mg', maximo: 2000, texto: '25 a 50 mg/kg (máx. 2 g) em 20 a 30 min, monitorizado; 15 min se ameaça à vida; pode repetir a cada 6 h', pagina: 'p. 557' },
  moderada: { id: 'mg-moderada', nome: 'Magnésio EV (moderada)', porKg: [0.3, 0.8], unidade: 'mEq/dia', maximo: 24, texto: '0,3 a 0,8 mEq/kg/dia (no máximo 8 a 24 mEq/dia)', pagina: 'p. 557',
    nota: 'O teto do livro é uma faixa (8 a 24 mEq/dia); a ferramenta limita no maior valor e mostra o menor ao lado.' },
  leve: { id: 'mg-leve', nome: 'Magnésio enteral (leve)', porKg: [10, 20], unidade: 'mg/dose', texto: '10 a 20 mg/kg/dose em 3 a 4 doses diárias', pagina: 'p. 557' },
}

/** As doses devem ser diminuídas em 50% na insuficiência renal (p. 557). */
export const FATOR_IR_MG = 0.5

/** mL de sulfato de magnésio 10% (100 mg/mL) para uma dose em mg. */
export const mlSulfMg10 = (mg: number) => (positivo(mg) ? mg / 100 : null)

/** FEMg = [(UMg × PCr)/(0,7 × PMg × UCr)] × 100; < 2% extrarrenal, > 4% renal (p. 557). */
export function fracaoExcrecaoMg(uMg: number, pCr: number, pMg: number, uCr: number): { femg: number; leitura: string } | null {
  if (!positivo(uMg, pCr, pMg, uCr)) return null
  const femg = ((uMg * pCr) / (0.7 * pMg * uCr)) * 100
  const leitura = femg < 2 ? 'sugere perda extrarrenal (< 2%)' : femg > 4 ? 'sugere perda renal (> 4%)' : 'entre 2 e 4%: o livro não interpreta essa faixa'
  return { femg, leitura }
}

/** Hipermagnesemia com ameaça à vida: cálcio EV em 5–10 min, repetível a cada 10 min (p. 558). */
export const HIPERMAGNESEMIA: Dose[] = [
  { id: 'cloreto-ca-mg', nome: 'Cloreto de cálcio', porKg: [20, 20], unidade: 'mg', maximo: 1000, texto: '20 mg/kg/dose (máx. 1 g/dose) EV em 5 a 10 min', pagina: 'p. 558' },
  { id: 'gluconato-ca-mg', nome: 'Gluconato de cálcio', porKg: [100, 100], unidade: 'mg', maximo: 3000, texto: '100 mg/kg/dose (máx. 3 g/dose) EV em 5 a 10 min', pagina: 'p. 558' },
]

// ---------------------------------------------------------------- fósforo

export const LIMIARES_P = { normal: [4, 7] as [number, number], sintomas: [1, 1.5] as [number, number] } // mg/dL (p. 553–554)

export const FOSFORO: Dose[] = [
  { id: 'p-vo', nome: 'Fósforo VO', porKg: [2, 3], unidade: 'mmol/dia', texto: '2 a 3 mmol/kg/dia em 3 a 4 vezes', pagina: 'p. 554' },
  { id: 'p-ev', nome: 'Fósforo EV (hipofosfatemia grave)', porKg: [0.08, 0.16], unidade: 'mmol', texto: '0,08 a 0,16 mmol/kg em 6 horas', pagina: 'p. 554' },
]

/** mL de fósforo orgânico (31 mg P/mL = 1 mmol/mL; traz 2 mEq/mL de Na) — Tabela 11, p. 559. */
export const mlFosforoOrganico = (mmol: number) => (positivo(mmol) ? (mmol * 31) / APRESENTACOES.fosforoOrganicoMgPMl : null)

