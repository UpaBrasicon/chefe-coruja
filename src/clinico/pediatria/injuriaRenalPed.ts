import { fichaP4, type DoseLivro } from './fonteP4.ts'
import { porPeso, positivoP5, type ItemLivro } from './fonteP5.ts'

// Injúria renal aguda na criança — livro do ICr, cap. 56 (p. 575–587).
// Estadiamento KDIGO pediátrico (Tabela 1), Schwartz (Tabela 2), FeNa, relação
// ureia/creatinina, sobrecarga hídrica, furosemida, profilaxia da nefropatia
// por contraste e as doses da Tabela 8. O capítulo cita o pRIFLE mas não o
// transcreve: fica de fora. Sem valor neonatal explícito nas doses.

export const fichaInjuriaRenalPed = fichaP4('ped-injuria-renal', 'Injúria renal aguda — KDIGO, Schwartz e doses (criança)', 'cap. 56, p. 575–587')

export type EstagioKdigo = 0 | 1 | 2 | 3

/**
 * Critério creatinina (Tabela 1, p. 576): 1 = aumento ≥ 0,3 mg/dL em < 48 h ou
 * 1,5–1,9 vez a basal em 7 dias; 2 = 2 a 2,9 vezes; 3 = > 3 vezes, eTFG < 35
 * mL/min/1,73 m² ou terapia de substituição renal.
 */
export function kdigoCreatinina(v: { basal: number; atual: number; subiu03em48h?: boolean; tfg?: number; tsr?: boolean }): EstagioKdigo | null {
  if (v.tsr || (v.tfg !== undefined && positivoP5(v.tfg) && v.tfg < 35)) return 3
  if (!positivoP5(v.basal, v.atual)) return v.subiu03em48h ? 1 : null
  const r = Math.round((v.atual / v.basal) * 1000) / 1000
  if (r > 3) return 3
  if (r >= 2) return 2
  if (r >= 1.5 || v.subiu03em48h) return 1
  return 0
}

export const NOTA_KDIGO =
  'Tabela 1 (p. 576): estágio 2 "2 a 2,9 vezes" e estágio 3 "maior que 3 vezes". Entre 2,9 e 3,0 vezes a ferramenta mantém o estágio 2; exatamente 3 vezes também fica no 2, como impresso.'

/**
 * Critério fluxo urinário (Tabela 1): 1 = < 0,5 mL/kg/h por 6–12 h; 2 = < 0,5 por
 * mais de 12 h; 3 = < 0,3 por mais de 24 h ou anúria por mais de 12 h.
 */
export function kdigoDiurese(mlKgH: number, horas: number): EstagioKdigo | null {
  if (!Number.isFinite(mlKgH) || mlKgH < 0 || !positivoP5(horas)) return null
  if (mlKgH === 0 && horas > 12) return 3
  if (mlKgH < 0.3 && horas > 24) return 3
  if (mlKgH < 0.5 && horas > 12) return 2
  if (mlKgH < 0.5 && horas >= 6) return 1
  return 0
}

/** Estágio final = o pior entre os dois critérios. */
export const kdigo = (a: EstagioKdigo | null, b: EstagioKdigo | null): EstagioKdigo | null =>
  a === null && b === null ? null : (Math.max(a ?? 0, b ?? 0) as EstagioKdigo)

/** Tabela 2 (p. 576): constante k do método colorimétrico (Jaffé). */
export const K_JAFFE: { id: string; texto: string; k: number }[] = [
  { id: 'rnbp', texto: 'Recém-nascido de baixo peso até 1 ano', k: 0.33 },
  { id: 'rnt', texto: 'Recém-nascido de termo até 1 ano', k: 0.45 },
  { id: 'crianca', texto: 'Crianças maiores e meninas até a adolescência', k: 0.55 },
  { id: 'menino', texto: 'Meninos adolescentes', k: 0.7 },
]

/** Método enzimático (Tabela 2a): k = 0,413. */
export const K_ENZIMATICO = 0.413

/** Schwartz: eTFG (mL/min/1,73 m²) = estatura (cm) × k ÷ creatinina (mg/dL). */
export function schwartz(estaturaCm: number, creatinina: number, k: number): number | null {
  return positivoP5(estaturaCm, creatinina, k) ? (estaturaCm * k) / creatinina : null
}

/** Creatinina de base desconhecida: a correspondente a TFG 120 pela Schwartz (p. 575). */
export function creatininaBasalEstimada(estaturaCm: number, k: number): number | null {
  return positivoP5(estaturaCm, k) ? (estaturaCm * k) / 120 : null
}

/** FeNa (%) = (Na urinário × creatinina sérica) ÷ (Na sérico × creatinina urinária) × 100 (p. 581). */
export function fena(v: { naU: number; crS: number; naS: number; crU: number }): number | null {
  return positivoP5(v.naU, v.crS, v.naS, v.crU) ? ((v.naU * v.crS) / (v.naS * v.crU)) * 100 : null
}

/** Relação ureia/creatinina séricas; > 40 é um dos indicativos de hipovolemia (p. 581). */
export function relacaoUreiaCreatinina(ureia: number, creatinina: number): number | null {
  return positivoP5(ureia, creatinina) ? ureia / creatinina : null
}

/** % sobrecarga volêmica = (ganhos L − perdas L) ÷ peso na admissão (kg) × 100 (p. 585). */
export function sobrecargaHidrica(ganhosL: number, perdasL: number, pesoAdmissaoKg: number): number | null {
  if (!positivoP5(pesoAdmissaoKg) || !Number.isFinite(ganhosL) || !Number.isFinite(perdasL) || ganhosL < 0 || perdasL < 0) return null
  return ((ganhosL - perdasL) / pesoAdmissaoKg) * 100
}

export const NOTA_SOBRECARGA =
  'Texto (p. 584–585): sobrecarga > 20% antes da TSR teve risco 8,5 vezes maior de morte; considerar TSR com > 20% e falha do tratamento conservador. Tabela 9 (p. 586): "sobrecarga hídrica significativa > 10% ganho ponderal" entre as indicações de emergência. As duas passagens são mostradas.'

/** Tabela 7 (p. 582): leitura urinária de referência — FeNa. */
export function leituraFena(fenaPct: number, rn: boolean): string | null {
  if (!Number.isFinite(fenaPct) || fenaPct < 0) return null
  const baixo = rn ? 2 : 1
  const alto = rn ? 2.5 : 2
  if (fenaPct < baixo) return `FeNa < ${baixo}%: padrão da alteração funcional (e da glomerulopatia) na Tabela 7.`
  if (fenaPct > alto) return `FeNa > ${alto}%: padrão da necrose tubular aguda na Tabela 7.`
  return 'FeNa entre os dois cortes da Tabela 7.'
}

/** Hidratação profilática do contraste: SF ou bicarbonato com 150 mEq/L de Na, 1 a 3 mL/kg/h, 12 h antes a 12 h depois (p. 584). */
export const hidratacaoContrasteMlH = (pesoKg: number) => porPeso([1, 3], pesoKg)

export const DOSES_IRA: DoseLivro[] = [
  { id: 'furosemida', nome: 'Furosemida — hipervolemia na IRA', unidade: 'mg', porKgDose: [1, 1.5], via: 'EV; sem resposta em 2 h, evitar novas doses', pagina: 'p. 585' },
  { id: 'nac-contraste', nome: 'N-acetilcisteína — profilaxia do contraste (> 30 dias de vida)', unidade: 'mg', porKgDose: [40, 40], doses: [2, 2], maxDose: 1200, via: 'VO de 12/12 h, 4 doses, começando 24 h antes; nunca EV nesta indicação', pagina: 'p. 584',
    nota: 'O livro diz "dose máxima de 1.200 mg"; a ferramenta aplica por dose. Só se o paciente não precisar de jejum.' },
]

/** Tabela 8 (p. 583): tratamentos das alterações hidroeletrolíticas e acidobásicas na IRA. */
export const DOSES_TABELA8: DoseLivro[] = [
  { id: 'cacl', nome: 'Cloreto de cálcio 10% — K > 7 ou alteração de ECG; hipocalcemia sintomática', unidade: 'mg', porKgDose: [20, 25], via: 'EV em 2 a 5 min', pagina: 'p. 583' },
  { id: 'gluconato', nome: 'Gluconato de cálcio 10% — K > 7 ou alteração de ECG; hipocalcemia sintomática', unidade: 'mg', porKgDose: [50, 100], via: 'EV em 2 a 5 min (0,5 a 1 mL/kg)', pagina: 'p. 583' },
  { id: 'bic', nome: 'Bicarbonato de sódio 8,4% — hipercalemia', unidade: 'mEq', porKgDose: [1, 2], via: 'EV em 5 a 15 min', pagina: 'p. 583' },
  { id: 'insulina', nome: 'Solução polarizante — insulina regular', unidade: 'UI', porKgDose: [0.1, 0.2], via: 'EV, com glicose 0,5 a 1 g/kg', pagina: 'p. 583' },
  { id: 'glicose', nome: 'Solução polarizante — glicose', unidade: 'g', porKgDose: [0.5, 1], via: 'EV, com a insulina', pagina: 'p. 583' },
  { id: 'beta2', nome: 'Beta-2 agonista EV — hipercalemia', unidade: 'µg', porKgDose: [4, 4], via: 'EV em 20 minutos (ou 400 µg inalatório)', pagina: 'p. 583',
    errata: 'Tabela 8 (p. 583): a dose inalatória está impressa "400 µ", sem a unidade completa.' },
  { id: 'furo-k', nome: 'Furosemida — hipercalemia', unidade: 'mg', porKgDose: [1, 1], via: 'EV', pagina: 'p. 583' },
  { id: 'sorcal', nome: 'Poliestirenossulfonato de cálcio (Sorcal)', unidade: 'g', porKgDose: [1, 2], via: 'VO ou retal', pagina: 'p. 583',
    nota: 'Apêndice (p. 907): 0,5 a 1 g/kg/dose, 2 a 4 vezes ao dia — divergência com a Tabela 8.' },
  { id: 'gluconato-assint', nome: 'Gluconato de cálcio 10% — hipocalcemia assintomática', unidade: 'mg', porKgDia: [200, 800], doses: [4, 4], via: 'EV de 6/6 h (2 a 8 mL/kg/dia)', pagina: 'p. 583' },
  { id: 'mg', nome: 'Magnésio elementar — sintomático ou < 1,2 mg/dL', unidade: 'mg', porKgDose: [2, 5], via: 'EV em 8 a 24 h; se necessário, bolus de 1 a 2 mg/kg em 5 min', pagina: 'p. 583' },
]

/** Tabela 8: hiponatremia aguda sintomática ou < 120 — Na (mEq) = (130 − Na) × peso × 0,6; NaCl 3% = 0,5 mEq/mL. */
export function sodioIra(pesoKg: number, naSerico: number): { meq: number; mlNaCl3: number } | null {
  if (!positivoP5(pesoKg, naSerico) || naSerico >= 130) return null
  const meq = (130 - naSerico) * pesoKg * 0.6
  return { meq, mlNaCl3: meq / 0.5 }
}

/** Tabela 8: bicarbonato se pH < 7,1 e/ou HCO3 < 10 — déficit = (15 − HCO3) × peso × 0,3. */
export function bicarbonatoIra(pesoKg: number, hco3: number): number | null {
  return positivoP5(pesoKg) && Number.isFinite(hco3) && hco3 >= 0 && hco3 < 15 ? (15 - hco3) * pesoKg * 0.3 : null
}

/** Tabela 7 (p. 582). */
export const TABELA7: [string, string, string, string][] = [
  ['Densidade', '1020', '1010', '1020'],
  ['Osmolaridade urinária (mmol/L)', '> 500', '< 350', '> 500'],
  ['Sódio urinário (mEq/L)', '< 20', '> 40', '< 20'],
  ['FeNa (%)', '< 1 (RN < 2)', '> 2 (RN > 2,5)', '< 1 (RN < 2)'],
  ['Fração de excreção de ureia (%)', '< 35', '> 50', '< 35'],
  ['Creatinina urinária/plasmática', '> 40', '< 20', '> 40'],
  ['Sedimento', 'Sem alterações relevantes', 'Cilindros amarronzados, epiteliais, granulosos', 'Cilindros celulares, hemáticos, dismorfismo'],
]

/** Tabela 9 (p. 586): indicações de TSR de emergência. */
export const INDICACOES_TSR: string[] = [
  'Hipervolemia (sobrecarga hídrica significativa > 10% de ganho ponderal, impossibilidade de nutrição adequada, transfusões frequentes)',
  'Hiperpotassemia refratária',
  'Acidose metabólica grave refratária',
  'Sinais/sintomas de uremia (sangramentos, encefalopatia, pericardite)',
  'Intoxicação exógena por droga dialisável',
  'Hiperamonemia',
]

export const REFERENCIAS_IRA: ItemLivro[] = [
  { texto: 'KDIGO vale para 1 mês a 18 anos. Sem creatinina basal, usar a que corresponde a TFG de 120 mL/min/1,73 m² pela Schwartz ou tabelas por idade e sexo.', pagina: 'p. 575' },
  { texto: 'Schwartz 0,413 com creatinina enzimática; constante k por idade com método colorimétrico (Jaffé).', pagina: 'p. 576' },
  { texto: 'FeNa tem interpretação prejudicada com diurético ou glicosúria; a fração de excreção de ureia é mais sensível e específica nessa situação.', pagina: 'p. 581' },
  { texto: 'Ácido úrico > 15 mg/dL sugere rabdomiólise ou lise tumoral.', pagina: 'p. 582' },
  { texto: 'Suspender diuréticos, iECA e BRA ao desenvolver IRA; evitar AINH e contraste; ajustar doses pela TFG.', pagina: 'p. 584' },
  { texto: 'Balanço hídrico rigoroso a cada 4 a 6 horas após a ressuscitação.', pagina: 'p. 585' },
]
