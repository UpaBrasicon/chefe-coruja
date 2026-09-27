import { fichaAdulto } from './fonte.ts'

// Distúrbios acidobásicos — cap. 69 do Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022), p. 931–945. Só as fórmulas e cortes que o livro
// escreve; a leitura clínica do conjunto é do profissional (ADR 0007).

export const fichaGasometria = fichaAdulto('adulto-gasometria', 'Distúrbios acidobásicos — análise da gasometria', 'cap. 69, p. 931–945; gap osmolar, p. 1326 e 1512')
export const fichaBicarbonato = fichaAdulto('adulto-bicarbonato', 'Bicarbonato de sódio — déficit e esquemas do manual', 'cap. 69, p. 937–938; cap. 67, Tab. 6, p. 916')

export type Referencia = { texto: string; pagina: string; errata?: string }

const ok = (...xs: (number | undefined)[]) => xs.every((x) => x !== undefined && Number.isFinite(x))

/** Tabela 1 (p. 931): valores de referência da gasometria arterial. */
export const REFERENCIA_GASOMETRIA = { ph: [7.35, 7.45] as [number, number], hco3: [21, 27] as [number, number], pco2: [35, 45] as [number, number] }
/** Valores "normais" usados pelo livro nas contas de delta e de compensação (p. 936, 938, 942). */
export const HCO3_NORMAL = 24
export const PCO2_NORMAL = 40
export const AG_NORMAL_DELTA = 10

export const ERRATA_CORTES_FIGURAS =
  'As Figuras 1 e 2 (p. 944–945) usam cortes um pouco diferentes da Tabela 1 (p. 931): pCO2 > 44 (acidose respiratória), pH > 7,44 e pCO2 < 36 (alcalemia). A ferramenta usa a Tabela 1 (pH 7,35–7,45; HCO3 21–27; pCO2 35–45).'

/** Henderson-Hasselbalch (p. 931): pH = 6,10 + log(HCO3 / (0,03 × pCO2)). */
export function phHendersonHasselbalch(hco3: number, pco2: number): number | null {
  if (!ok(hco3, pco2) || hco3 <= 0 || pco2 <= 0) return null
  return 6.1 + Math.log10(hco3 / (0.03 * pco2))
}

/** Winter (p. 934): pCO2 esperada = 1,5 × HCO3 + 8 ± 2. */
export function pco2EsperadaWinter(hco3: number): [number, number] | null {
  if (!ok(hco3) || hco3 <= 0) return null
  const c = 1.5 * hco3 + 8
  return [c - 2, c + 2]
}

/** Alternativa do livro (p. 934): pCO2 esperada = HCO3 + 15. */
export const pco2EsperadaMais15 = (hco3: number) => (ok(hco3) && hco3 > 0 ? hco3 + 15 : null)

/** Alcalose metabólica (p. 938): pCO2 esperada = 0,7 × (HCO3 − 24) + 40 ± 2. */
export function pco2EsperadaAlcalose(hco3: number): [number, number] | null {
  if (!ok(hco3) || hco3 <= 0) return null
  const c = 0.7 * (hco3 - HCO3_NORMAL) + PCO2_NORMAL
  return [c - 2, c + 2]
}

export type Tempo = 'aguda' | 'cronica'

/**
 * HCO3 esperado nos distúrbios respiratórios (p. 942), por 10 mmHg de pCO2
 * acima/abaixo de 40: acidose aguda +1, crônica +4 a 5; alcalose aguda −2,
 * crônica −4 a 5. Base de 24 mEq/L (valor normal que o livro usa).
 */
export function hco3EsperadoRespiratorio(pco2: number, tempo: Tempo): [number, number] | null {
  if (!ok(pco2) || pco2 <= 0) return null
  const d = (pco2 - PCO2_NORMAL) / 10
  if (d >= 0) return tempo === 'aguda' ? [HCO3_NORMAL + d, HCO3_NORMAL + d] : [HCO3_NORMAL + 4 * d, HCO3_NORMAL + 5 * d]
  const q = -d
  return tempo === 'aguda' ? [HCO3_NORMAL - 2 * q, HCO3_NORMAL - 2 * q] : [HCO3_NORMAL - 5 * q, HCO3_NORMAL - 4 * q]
}

/** Ânion-gap (p. 935): AG = Na − (HCO3 + Cl). */
export function anionGap(na: number, hco3: number, cl: number): number | null {
  if (!ok(na, hco3, cl)) return null
  return na - (hco3 + cl)
}

/** AG corrigido pela albumina (p. 936): AG + 2,5 × (4,0 − albumina). */
export function anionGapCorrigido(ag: number, albumina: number): number | null {
  if (!ok(ag, albumina) || albumina < 0) return null
  return ag + 2.5 * (4 - albumina)
}

export type LeituraDelta = { razao: number; deltaAG: number; deltaHCO3: number; texto: string }

/** ΔAG/ΔHCO3 (p. 936): ΔAG = AG − 10; ΔHCO3 = 24 − HCO3. */
export function deltaDelta(ag: number, hco3: number): LeituraDelta | null {
  if (!ok(ag, hco3)) return null
  const deltaAG = ag - AG_NORMAL_DELTA
  const deltaHCO3 = HCO3_NORMAL - hco3
  if (deltaHCO3 <= 0) return null
  const razao = deltaAG / deltaHCO3
  const texto = razao < 1
    ? 'Δ/Δ < 1: o livro lê como acidose com AG aumentado + acidose hiperclorêmica coexistentes (p. ex., diarreia grave), acidose de AG aumentado com ânions excretados na urina (p. ex., cetoacidose) ou ATR IV em DRC inicial.'
    : razao <= 2
      ? 'Δ/Δ 1–2: o livro lê como acidose com AG aumentado no contexto de função renal reduzida e retenção de ânions ácidos (p. ex., acidose lática).'
      : 'Δ/Δ > 2: o livro lê como acidose com AG aumentado coexistente com alcalose metabólica, ou HCO3 elevado de acidose respiratória crônica.'
  return { razao, deltaAG, deltaHCO3, texto }
}

/** AG urinário (p. 936–937): Na + K − Cl; negativo → causa GI; positivo → falência renal na geração de NH4 (ATR I, IV, IRA precoce). */
export function anionGapUrinario(na: number, k: number, cl: number) {
  if (!ok(na, k, cl)) return null
  const valor = na + k - cl
  const texto = valor < 0
    ? 'AG urinário negativo: resposta renal preservada à acidemia (principalmente causas gastrointestinais).'
    : valor > 0
      ? 'AG urinário positivo: falência renal na geração de NH4+ (ATR I, ATR IV, fase precoce de IRA).'
      : 'AG urinário igual a zero: sem sinal definido.'
  return { valor, texto }
}

/** Tabela 4 (p. 937): acidoses tubulares renais. Só para consulta. */
export const TABELA_ATR = [
  { tipo: 'Proximal (II)', mecanismo: 'Redução da reabsorção de bicarbonato', grau: 'Moderada', potassio: 'Baixo', phUrinario: '< 5,3 (eleva-se com o tratamento)', agUrinario: 'Variável' },
  { tipo: 'Distal (I)', mecanismo: 'Bloqueio na secreção distal de H+', grau: 'Grave', potassio: 'Baixo', phUrinario: '> 5,5', agUrinario: 'Positivo' },
  { tipo: 'Hipoaldosteronismo (IV)', mecanismo: 'Bloqueio na secreção distal de K+ e H+', grau: 'Leve', potassio: 'Elevado', phUrinario: '< 5,3', agUrinario: 'Positivo' },
]

/** Cloro urinário na alcalose metabólica (Tab. 6, p. 940; Fig. 2, p. 945). */
export function lerCloroUrinario(cl: number): Referencia | null {
  if (!ok(cl) || cl < 0) return null
  if (cl < 20) return { texto: 'Cl urinário < 10–20 mEq/L: alcalose salina-responsiva (vômitos, drenagem nasogástrica, uso prévio de diurético, laxativos, pós-hipercapnia, hipovolemia). Com diurético em uso o Cl urinário fica > 20.', pagina: 'Tab. 6, p. 940; Fig. 2, p. 945' }
  if (cl > 25) return { texto: 'Cl urinário > 25 mEq/L: alcalose salina-resistente — com hipertensão, excesso de mineralocorticoide; normotenso, uso atual de diurético, Bartter/Gitelman, hipocalemia grave (K < 2,0), álcali exógeno.', pagina: 'Tab. 6, p. 940; p. 941; Fig. 2, p. 945',
    errata: 'Na p. 941 o livro escreve "Acidose metabólica associada a volume expandido" dentro da alcalose metabólica com Cl urinário > 25; é alcalose.' }
  return { texto: 'Cl urinário entre 20 e 25 mEq/L: entre os cortes do livro (< 10–20 responsiva; > 25 resistente), sem classificação.', pagina: 'Tab. 6, p. 940' }
}

/** Gap osmolar = osmolaridade medida − calculada (p. 1512); > 15 mOsm/kg na fase precoce da intoxicação por álcoois tóxicos (p. 1326). */
export function gapOsmolar(medida: number, calculada: number) {
  if (!ok(medida, calculada) || medida <= 0 || calculada <= 0) return null
  const valor = medida - calculada
  return { valor, acimaDe15: valor > 15 }
}

/** Gasometria venosa (p. 932): pH venoso periférico ~0,02–0,04 menor que o arterial. */
export function phArterialEstimado(phVenoso: number): [number, number] | null {
  if (!ok(phVenoso) || phVenoso <= 0) return null
  return [phVenoso + 0.02, phVenoso + 0.04]
}

export type Primario = 'acidose metabólica' | 'acidose respiratória' | 'alcalose metabólica' | 'alcalose respiratória'

export type Compensacao = { primario: Primario; esperado: string; leitura: string; pagina: string }

export type AnaliseGasometria = {
  estado: 'acidemia' | 'alcalemia' | 'pH na faixa de referência'
  primarios: Primario[]
  compensacoes: Compensacao[]
  phCalculado: number | null
  observacoes: string[]
}

const f1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString('pt-BR')

/** Passos 1 e 2 da p. 933–934: acidemia/alcalemia, distúrbio primário (Tab. 1) e compensação esperada. */
export function analisarGasometria(e: { ph: number; pco2: number; hco3: number; tempoRespiratorio?: Tempo }): AnaliseGasometria | null {
  if (!ok(e.ph, e.pco2, e.hco3) || e.ph <= 0 || e.pco2 <= 0 || e.hco3 <= 0) return null
  const R = REFERENCIA_GASOMETRIA
  const estado = e.ph < R.ph[0] ? 'acidemia' : e.ph > R.ph[1] ? 'alcalemia' : 'pH na faixa de referência'
  const primarios: Primario[] = []
  if (estado === 'acidemia') {
    if (e.hco3 < R.hco3[0]) primarios.push('acidose metabólica')
    if (e.pco2 > R.pco2[1]) primarios.push('acidose respiratória')
  } else if (estado === 'alcalemia') {
    if (e.hco3 > R.hco3[1]) primarios.push('alcalose metabólica')
    if (e.pco2 < R.pco2[0]) primarios.push('alcalose respiratória')
  }
  const compensacoes: Compensacao[] = []
  for (const p of primarios) {
    if (p === 'acidose metabólica') {
      const [a, b] = pco2EsperadaWinter(e.hco3)!
      compensacoes.push({ primario: p, pagina: 'p. 934',
        esperado: `pCO2 esperada (Winter) ${f1(a)}–${f1(b)} mmHg; pela alternativa HCO3 + 15: ${f1(e.hco3 + 15)} mmHg`,
        leitura: e.pco2 > b ? 'pCO2 medida acima da predita: o livro lê como acidose respiratória concomitante.' : e.pco2 < a ? 'pCO2 medida abaixo da predita: o livro lê como alcalose respiratória concomitante.' : 'pCO2 na faixa predita: sem distúrbio respiratório associado.' })
    } else if (p === 'alcalose metabólica') {
      const [a, b] = pco2EsperadaAlcalose(e.hco3)!
      compensacoes.push({ primario: p, pagina: 'p. 938',
        esperado: `pCO2 esperada ${f1(a)}–${f1(b)} mmHg`,
        leitura: e.pco2 > b ? 'pCO2 medida acima da predita: o livro lê como acidose respiratória concomitante.' : e.pco2 < a ? 'pCO2 medida abaixo da predita: o livro lê como alcalose respiratória concomitante.' : 'pCO2 na faixa predita.' })
    } else {
      const tempos: Tempo[] = e.tempoRespiratorio ? [e.tempoRespiratorio] : ['aguda', 'cronica']
      for (const t of tempos) {
        const [a, b] = hco3EsperadoRespiratorio(e.pco2, t)!
        const faixa = a === b ? `${f1(a)}` : `${f1(a)}–${f1(b)}`
        compensacoes.push({ primario: p, pagina: 'p. 942',
          esperado: `HCO3 esperado (${t === 'aguda' ? 'aguda' : 'crônica'}): ${faixa} mEq/L${a === b ? ' — o livro não traz margem para esta regra' : ''}`,
          leitura: e.hco3 > b ? 'HCO3 medido acima do predito: o livro lê como alcalose metabólica concomitante.' : e.hco3 < a ? 'HCO3 medido abaixo do predito: o livro lê como acidose metabólica concomitante.' : 'HCO3 no valor predito.' })
      }
    }
  }
  const observacoes: string[] = []
  if (estado === 'pH na faixa de referência' && (e.hco3 < R.hco3[0] || e.hco3 > R.hco3[1] || e.pco2 < R.pco2[0] || e.pco2 > R.pco2[1]))
    observacoes.push('pH na faixa de referência com HCO3 ou pCO2 alterados: os fluxogramas do livro partem de acidemia ou alcalemia (Fig. 1 e 2, p. 944–945); a ferramenta não define distúrbio primário.')
  if ((estado === 'acidemia' || estado === 'alcalemia') && primarios.length === 0)
    observacoes.push('Alteração do pH sem HCO3 ou pCO2 fora da referência na mesma direção: confira os valores.')
  const phCalculado = phHendersonHasselbalch(e.hco3, e.pco2)
  if (phCalculado !== null && Math.abs(phCalculado - e.ph) > 0.05)
    observacoes.push(`O pH calculado por Henderson-Hasselbalch (${phCalculado.toFixed(2).replace('.', ',')}) difere do medido em mais de 0,05: confira se os valores são da mesma amostra.`)
  return { estado, primarios, compensacoes, phCalculado, observacoes }
}

// ─────────────────────────── Bicarbonato ───────────────────────────

/** NaHCO3 8,4%: 50 mEq/50 mL (p. 938) = 1 mEq/mL. */
export const NAHCO3_84_MEQ_POR_ML = 50 / 50

/** Déficit (p. 938) = 0,6 × peso × (24 − HCO3). "Nunca deve ser totalmente reposto (não é uma meta)." */
export function deficitBicarbonato(pesoKg: number, hco3: number): number | null {
  if (!ok(pesoKg, hco3) || pesoKg <= 0 || hco3 < 0) return null
  return Math.max(0, 0.6 * pesoKg * (HCO3_NORMAL - hco3))
}

/** Critério laboratorial que o livro descreve (p. 937): pH < 7,1 com HCO3 < 8 (e quadro agudo e sintomático). */
export function criterioLaboratorialBicarbonato(ph: number, hco3: number): boolean | null {
  if (!ok(ph, hco3)) return null
  return ph < 7.1 && hco3 < 8
}

export type EsquemaBic = Referencia & { id: string; mlNaHCO3: number; diluenteMl: number; horas: [number, number] | null }

export const ESQUEMAS_BICARBONATO: EsquemaBic[] = [
  { id: 'cad', mlNaHCO3: 100, diluenteMl: 400, horas: [2, 2], texto: 'Cetoacidose diabética: bicarbonato de sódio somente se pH < 6,9 — 100 mL de NaHCO3 8,4% em 400 mL de água destilada, EV em 2 horas.', pagina: 'cap. 69, p. 938' },
  { id: 'hipercalemia', mlNaHCO3: 150, diluenteMl: 1000, horas: [2, 4], texto: 'Hipercalemia (Tab. 6): NaHCO3 8,4% 150 mL + SG 5% 1.000 mL, IV em 2–4 horas; eficácia limitada, atentar para sobrecarga volêmica.', pagina: 'cap. 67, p. 916' },
]

export function calcularEsquemaBic(id: string) {
  const e = ESQUEMAS_BICARBONATO.find((x) => x.id === id)
  if (!e || !e.horas) return null
  const volume = e.mlNaHCO3 + e.diluenteMl
  const mEq = e.mlNaHCO3 * NAHCO3_84_MEQ_POR_ML
  return { mEq, volumeTotalMl: volume, concentracaoMEqL: mEq / (volume / 1000), mlH: [volume / e.horas[1], volume / e.horas[0]] as [number, number] }
}

export const REFERENCIAS_BICARBONATO: Referencia[] = [
  { texto: 'Não há consenso sobre a reposição de bicarbonato; de forma geral o livro a descreve na acidemia grave (pH < 7,1), aguda e sintomática, com HCO3 < 8 mEq/L. Acidoses agudas menos graves geralmente não requerem bicarbonato.', pagina: 'p. 937–938' },
  { texto: 'Idealmente, aumentar o bicarbonato para 8–10 mEq/L e o pH para 7,15–7,20.', pagina: 'p. 938' },
  { texto: 'Em um homem de 70 kg, 50 mL de NaHCO3 8,4% (50 mEq) aumentam o HCO3 em aproximadamente 1,3–1,5 mEq/L; o volume de distribuição varia com a acidose.', pagina: 'p. 938' },
  { texto: 'Intoxicação por salicilatos: alcalinizar o sangue para manter pH entre 7,5 e 7,6.', pagina: 'p. 938' },
  { texto: 'Eventos adversos: sobrecarga volêmica, hipernatremia, redução do cálcio iônico, acidose respiratória e acidificação intracelular.', pagina: 'p. 937–938' },
]
