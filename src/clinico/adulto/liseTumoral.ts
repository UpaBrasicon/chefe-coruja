import { marcadas, somar, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Síndrome de lise tumoral — cap. 84 (emergências oncológicas) do Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022), p. 1099–1105. Só o adulto:
// o livro traz valores de criança (fósforo ≥ 6,5 mg/dL; 200 mL/kg/dia e 4-6
// mL/kg/h abaixo de 10 kg), que não são implementados. O livro não traz
// fórmula de superfície corporal: o usuário informa a SC em m².

const CAP = 'cap. 84 Emergências oncológicas — síndrome de lise tumoral'

export const fichaLiseTumoralAdulto = fichaAdulto('adulto-lise-tumoral', 'Síndrome de lise tumoral — prevenção e tratamento (adulto)', `${CAP}, p. 1100–1105 (Tabelas 2 e 4)`)

export type Faixa = [number, number]
const valido = (x: number) => Number.isFinite(x) && x > 0

// Cairo-Bishop (Tabela 3, p. 1102)

const LAB = ['urico', 'potassio', 'fosforo', 'calcio']
const CLIN = ['creatinina', 'arritmia', 'convulsao']

export const cairoBishop: Escore = {
  ficha: fichaAdulto('adulto-cairo-bishop', 'Critérios de Cairo-Bishop — síndrome de lise tumoral (adulto)', `${CAP}, p. 1102 (Tabela 3)`),
  descricao: 'SLT laboratorial: 2 critérios laboratoriais de 3 dias antes a 7 dias depois da terapia citotóxica. SLT clínica: laboratorial + 1 critério clínico.',
  itens: [
    { tipo: 'marca', id: 'urico', rotulo: 'Ácido úrico ≥ 8 mg/dL ou aumento de 25% do basal', pontos: 1, grupo: 'Critérios laboratoriais' },
    { tipo: 'marca', id: 'potassio', rotulo: 'Potássio ≥ 6,0 mEq/L ou aumento de 25% do basal', pontos: 1, grupo: 'Critérios laboratoriais' },
    { tipo: 'marca', id: 'fosforo', rotulo: 'Fósforo ≥ 4,5 mg/dL (adulto) ou aumento de 25% do basal', pontos: 1, grupo: 'Critérios laboratoriais' },
    { tipo: 'marca', id: 'calcio', rotulo: 'Cálcio ≤ 7 mg/dL ou redução de 25% do basal', pontos: 1, grupo: 'Critérios laboratoriais' },
    { tipo: 'marca', id: 'creatinina', rotulo: 'Creatinina ≥ 1,5 vez o limite superior da normalidade', pontos: 1, grupo: 'Critérios clínicos' },
    { tipo: 'marca', id: 'arritmia', rotulo: 'Arritmia cardíaca ou morte súbita', pontos: 1, grupo: 'Critérios clínicos' },
    { tipo: 'marca', id: 'convulsao', rotulo: 'Convulsão', pontos: 1, grupo: 'Critérios clínicos' },
  ],
  calcular(r) {
    const lab = somar(cairoBishop, r, LAB)
    const clin = somar(cairoBishop, r, CLIN)
    const laboratorial = lab >= 2
    const clinica = laboratorial && clin >= 1
    return {
      rotulo: 'Cairo-Bishop',
      valor: clinica ? 'SLT clínica' : laboratorial ? 'SLT laboratorial' : 'não preenche',
      nota: `${lab} critério(s) laboratorial(is) e ${clin} clínico(s)`,
      estado: clinica ? 2 : laboratorial ? 1 : 0,
      derivados: marcadas(cairoBishop, r).length ? [['Critérios marcados', marcadas(cairoBishop, r).join('; ')]] : [],
      alerta: !laboratorial && clin > 0 ? 'Critério clínico sem 2 laboratoriais não fecha SLT clínica pela Tabela 3.' : undefined,
      cuidados: [
        'Os critérios laboratoriais valem de 3 dias antes a 7 dias depois da terapia citotóxica (p. 1102).',
        'Pelo livro, SLT laboratorial é internada e SLT clínica vai para terapia intensiva, com eletrólitos, creatinina e ácido úrico a cada 4-6 h (p. 1104).',
        'O corte de fósforo para criança do livro (≥ 6,5 mg/dL) não entra: esta ferramenta é de adulto.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// Prevenção e tratamento (p. 1103–1105)

export const HIDRATACAO_SLT = { lM2Dia: [2, 3] as Faixa, lDiaAprox: [5, 6] as Faixa, diureseMlM2H: 100, diureseMlKgH: 2, pagina: 'p. 1103' }

export type ContaHidratacao = { lDia: Faixa; mlH: Faixa; diureseAlvoScMlH: number | null; diureseAlvoPesoMlH: number | null }

/** 2-3 L/m²/dia e diurese de 100 mL/m²/h ou 2 mL/kg/h (adulto) (p. 1103). */
export function hidratacaoSlt(scM2: number, pesoKg?: number): ContaHidratacao | null {
  if (!valido(scM2)) return null
  const lDia: Faixa = [HIDRATACAO_SLT.lM2Dia[0] * scM2, HIDRATACAO_SLT.lM2Dia[1] * scM2]
  return {
    lDia,
    mlH: [(lDia[0] * 1000) / 24, (lDia[1] * 1000) / 24],
    diureseAlvoScMlH: HIDRATACAO_SLT.diureseMlM2H * scM2,
    diureseAlvoPesoMlH: pesoKg !== undefined && valido(pesoKg) ? HIDRATACAO_SLT.diureseMlKgH * pesoKg : null,
  }
}

export const ALOPURINOL_SLT = { mgM2Dose: 100, intervaloH: 8, mgKgDia: 10, maxMgDia: 800, tomadas: 3, pagina: 'p. 1103' }

export type FuncaoRenalAlopurinol = 'normal' | 'ira' | 'clcr10a20' | 'clcrMenor10'

export type ContaAlopurinol = { porSc: { mgDose: number; mgDia: number } | null; porPeso: { mgDia: number; mgTomada: number; limitado: boolean } | null; ajusteRenal: string }

/**
 * Alopurinol: 100 mg/m²/dose 8/8 h, ou 10 mg/kg/dia até 800 mg/dia em 3 tomadas.
 * Ajuste: IRA reduz 50%; ClCr 10-20 → 200 mg/dia; ClCr < 10 → 100 mg/dia (p. 1103).
 */
export function alopurinolSlt(scM2: number | undefined, pesoKg: number | undefined, renal: FuncaoRenalAlopurinol): ContaAlopurinol {
  const a = ALOPURINOL_SLT
  const fator = renal === 'ira' ? 0.5 : 1
  const porSc = scM2 !== undefined && valido(scM2) && (renal === 'normal' || renal === 'ira')
    ? { mgDose: a.mgM2Dose * scM2 * fator, mgDia: a.mgM2Dose * scM2 * (24 / a.intervaloH) * fator }
    : null
  let porPeso: ContaAlopurinol['porPeso'] = null
  if (pesoKg !== undefined && valido(pesoKg) && (renal === 'normal' || renal === 'ira')) {
    const bruto = a.mgKgDia * pesoKg
    const limitado = bruto > a.maxMgDia
    const mgDia = Math.min(bruto, a.maxMgDia) * fator
    porPeso = { mgDia, mgTomada: mgDia / a.tomadas, limitado }
  }
  const ajusteRenal = {
    normal: 'sem ajuste',
    ira: 'IRA: dose reduzida em 50%',
    clcr10a20: 'ClCr 10-20 mL/min: dose fixa de 200 mg/dia',
    clcrMenor10: 'ClCr < 10 mL/min: dose fixa de 100 mg/dia',
  }[renal]
  return { porSc, porPeso, ajusteRenal }
}

export const RASBURICASE_SLT = { mgKg: [0.15, 0.2] as Faixa, dias: [1, 7] as Faixa, pagina: 'p. 1104' }

export function rasburicaseSlt(pesoKg: number): Faixa | null {
  return valido(pesoKg) ? [RASBURICASE_SLT.mgKg[0] * pesoKg, RASBURICASE_SLT.mgKg[1] * pesoKg] : null
}

/** Produto cálcio × fósforo; ≥ 70 mg²/dL² está entre as indicações de hemodiálise (p. 1105). */
export function produtoCalcioFosforo(calcioMgDl: number, fosforoMgDl: number): { produto: number; acimaDoCorte: boolean } | null {
  if (!valido(calcioMgDl) || !valido(fosforoMgDl)) return null
  const produto = calcioMgDl * fosforoMgDl
  return { produto, acimaDoCorte: produto >= 70 }
}

export const OUTRAS_SLT = [
  { texto: 'Alopurinol: iniciar 2-3 dias antes da quimioterapia no risco moderado; mercaptopurina e azatioprina com cerca de ⅓ da dose usual', pagina: 'p. 1103' },
  { texto: 'Rasburicase: alto risco ou ácido úrico basal > 8 mg/dL (ou alto apesar do alopurinol); contraindicada na deficiência de G6PD', pagina: 'p. 1103–1104' },
  { texto: 'Febuxostate: 40-120 mg VO ao dia', pagina: 'p. 1104' },
  { texto: 'Alcalinização urinária: controversa, só se acidose metabólica', pagina: 'p. 1103' },
  { texto: 'Hemodiálise: oligúria/anúria, congestão de difícil manejo, hipercalemia refratária, hiperfosfatemia com hipocalcemia sintomática, produto Ca × P ≥ 70 mg²/dL²', pagina: 'p. 1105' },
]

export const RISCO_SLT = [
  { neoplasia: 'Linfoma não Hodgkin', baixo: 'Indolente', moderado: 'Burkitt com DHL < 2x LSN; difuso de grandes células B', alto: 'Leucemia de Burkitt; Burkitt com DHL ≥ 2x LSN' },
  { neoplasia: 'LLA', baixo: '—', moderado: 'Leucócitos < 100.000 E DHL < 2x LSN', alto: 'Leucócitos ≥ 100.000 OU DHL ≥ 2x LSN' },
  { neoplasia: 'LMA', baixo: 'Leucócitos < 25.000 e DHL < 2x LSN', moderado: 'Leucócitos 25.000 a 100.000 OU < 25.000 com DHL ≥ 2x LSN', alto: 'Leucócitos ≥ 100.000' },
  { neoplasia: 'LLC', baixo: 'Só alquilantes E leucócitos < 50.000', moderado: 'Fludarabina, rituximab, lenalidomida ou venetoclax; OU alquilantes com leucócitos ≥ 50.000 e/ou linfócitos ≥ 25.000', alto: 'Venetoclax E linfonodo ≥ 10 cm, OU linfonodo ≥ 5 cm + linfócitos ≥ 25.000' },
  { neoplasia: 'Outras neoplasias', baixo: 'Maioria dos tumores sólidos', moderado: 'Tumores volumosos e muito sensíveis à quimioterapia', alto: '—' },
  { neoplasia: 'Agravantes clínicos', baixo: '—', moderado: 'Linfoma/leucemia de baixo risco E disfunção renal', alto: 'Neoplasia de risco intermediário E disfunção renal e/ou ácido úrico, potássio ou fósforo > 2x LSN' },
]
