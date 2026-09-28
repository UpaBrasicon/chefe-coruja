import { fichaIcr, ok, positivo } from './fonteIcr.ts'

// Distúrbios acidobásicos na criança — cap. 55 do Pronto-Socorro ICr-HCFMUSP
// (4ª ed., 2023), p. 561–573. Fórmulas de compensação (Tabela 3), ânion-gap,
// razão ΔAG/ΔHCO3, bicarbonato e HCl como o livro traz. A interpretação é apoio;
// o diagnóstico é do profissional (ADR 0007).

export const fichaAcidoBasePed = fichaIcr('ped-acidobase', 'Distúrbios acidobásicos — criança', 'cap. 55, p. 561–573')

/** Acidemia pH < 7,36; alcalemia pH > 7,44 (p. 561–562). */
export const PH_NORMAL: [number, number] = [7.36, 7.44]

/** Tabela 2 (p. 562): normal HCO3 25 ± 2 mM; pCO2 40 ± 2 mmHg. Base das variações (Δ) desta ferramenta. */
export const NORMAL_TABELA2 = { hco3: 25, pco2: 40, tolerancia: 2 }

/** Tabela 1 (p. 562) — valores gasométricos normais por idade (Cronan e Norman, 2000). */
export const NORMAIS_IDADE = [
  { faixa: 'Recém-nascido (nascimento)', ph: '7,26 a 7,29', pco2: '55', hco3: '19' },
  { faixa: 'Recém-nascido (24 h)', ph: '7,37', pco2: '33', hco3: '20' },
  { faixa: 'Lactente (até 1 ano)', ph: '7,40', pco2: '34', hco3: '20' },
  { faixa: 'Criança (7 a 19 anos)', ph: '7,39', pco2: '37', hco3: '22' },
] as const

// ---------------------------------------------------------------- Tabela 3 (p. 563)

/** Acidose metabólica: pCO2 esperada = (1,5 × HCO3 + 8) ± 2. */
export function pco2EsperadaAcidoseMetabolica(hco3: number): [number, number] | null {
  if (!positivo(hco3)) return null
  const c = 1.5 * hco3 + 8
  return [c - 2, c + 2]
}

export const ERRATA_ALCALOSE_METABOLICA =
  'Tabela 3 (p. 563): a compensação da alcalose metabólica está impressa "pCO2 = 0,9 × HCO3 ± 9". Lida como está, a faixa desce abaixo de 40 mmHg (ex.: HCO3 34 → 21,6 a 39,6 mmHg), o que contradiz a coluna "aumenta pCO2" da mesma linha. Sem forma inequívoca no livro, a ferramenta não calcula a pCO2 esperada da alcalose metabólica.'

export type Tempo = 'aguda' | 'cronica'

/** Coeficientes ΔHCO3/ΔpCO2 da Tabela 3 (p. 563) e do texto (p. 568 e 570). */
export const COEF_RESPIRATORIO = {
  acidose: { aguda: 0.1, cronica: 0.4 },
  alcalose: { aguda: 0.2, cronica: 0.5 },
}

/** HCO3 esperado num distúrbio respiratório primário: 25 + k × (pCO2 − 40), com k da Tabela 3. */
export function hco3EsperadoRespiratorio(pco2: number, tempo: Tempo): number | null {
  if (!positivo(pco2) || pco2 === NORMAL_TABELA2.pco2) return null
  const tipo = pco2 > NORMAL_TABELA2.pco2 ? 'acidose' : 'alcalose'
  return NORMAL_TABELA2.hco3 + COEF_RESPIRATORIO[tipo][tempo] * (pco2 - NORMAL_TABELA2.pco2)
}

export const NOTA_TEMPOS =
  'Tempos da Tabela 3 (p. 563): acidose respiratória aguda < 12 a 24 h, crônica 3 a 5 dias; alcalose respiratória aguda < 12 h, crônica 1 a 2 dias (o texto da p. 570 fala em 2 a 3 dias para o equilíbrio completo).'

// ---------------------------------------------------------------- leitura da gasometria (p. 571–572)

export type Primario = 'acidose metabólica' | 'acidose respiratória' | 'alcalose metabólica' | 'alcalose respiratória'

export type Leitura = {
  estado: 'acidemia' | 'alcalemia' | 'pH normal'
  primarios: Primario[]
  compensacao?: { esperado: string; dentro: boolean | null; texto: string }
  alertas: string[]
}

/**
 * As três etapas do livro (p. 571–572): pH → direção de HCO3 e pCO2 → compensação pela Tabela 3.
 * pH normal com HCO3/pCO2 alterados sugere distúrbio misto.
 */
export function lerGasometria(ph: number, pco2: number, hco3: number, tempo: Tempo = 'aguda'): Leitura | null {
  if (!positivo(ph, pco2, hco3)) return null
  const n = NORMAL_TABELA2
  const hco3Baixo = hco3 < n.hco3 - n.tolerancia
  const hco3Alto = hco3 > n.hco3 + n.tolerancia
  const pco2Alto = pco2 > n.pco2 + n.tolerancia
  const pco2Baixo = pco2 < n.pco2 - n.tolerancia
  const alertas: string[] = []

  if (ph >= PH_NORMAL[0] && ph <= PH_NORMAL[1]) {
    if (hco3Baixo || hco3Alto || pco2Alto || pco2Baixo)
      alertas.push('pH normal com HCO3 ou pCO2 alterados: o livro orienta suspeitar de distúrbio misto (p. 571–572).')
    return { estado: 'pH normal', primarios: [], alertas }
  }

  if (ph < PH_NORMAL[0]) {
    const primarios: Primario[] = []
    if (hco3Baixo) primarios.push('acidose metabólica')
    if (pco2Alto) primarios.push('acidose respiratória')
    if (primarios.length === 2) alertas.push('HCO3 baixo e pCO2 alta: acidose mista, respiratória e metabólica (p. 572).')
    let compensacao: Leitura['compensacao']
    if (primarios.length === 1 && primarios[0] === 'acidose metabólica') {
      const [a, b] = pco2EsperadaAcidoseMetabolica(hco3)!
      const dentro = pco2 >= a && pco2 <= b
      compensacao = { esperado: `pCO2 ${a.toFixed(1)}–${b.toFixed(1)} mmHg`, dentro, texto: dentro ? 'compensação dentro do esperado' : pco2 > b ? 'pCO2 acima do esperado: acidose respiratória associada?' : 'pCO2 abaixo do esperado: alcalose respiratória associada?' }
    } else if (primarios.length === 1) {
      const e = hco3EsperadoRespiratorio(pco2, tempo)!
      compensacao = compararHco3(e, hco3, tempo)
    }
    return { estado: 'acidemia', primarios, compensacao, alertas }
  }

  const primarios: Primario[] = []
  if (hco3Alto) primarios.push('alcalose metabólica')
  if (pco2Baixo) primarios.push('alcalose respiratória')
  if (primarios.length === 2) alertas.push('HCO3 alto e pCO2 baixa: alcalose mista (p. 572).')
  let compensacao: Leitura['compensacao']
  if (primarios.length === 1 && primarios[0] === 'alcalose metabólica') {
    compensacao = { esperado: '—', dentro: null, texto: 'pCO2 esperada não calculada (errata da Tabela 3, p. 563).' }
  } else if (primarios.length === 1) {
    compensacao = compararHco3(hco3EsperadoRespiratorio(pco2, tempo)!, hco3, tempo)
  }
  return { estado: 'alcalemia', primarios, compensacao, alertas }
}

function compararHco3(esperado: number, hco3: number, tempo: Tempo): NonNullable<Leitura['compensacao']> {
  // a Tabela 3 não traz margem para as fórmulas respiratórias; usa-se a tolerância de ± 2 da Tabela 2
  const t = NORMAL_TABELA2.tolerancia
  const dentro = Math.abs(hco3 - esperado) <= t
  return {
    esperado: `HCO3 ≈ ${esperado.toFixed(1)} mEq/L (${tempo})`,
    dentro,
    texto: dentro ? 'compensação dentro do esperado' : hco3 > esperado ? 'HCO3 acima do esperado: componente metabólico alcalótico associado?' : 'HCO3 abaixo do esperado: componente metabólico acidótico associado?',
  }
}

export const NOTA_MARGEM =
  'A Tabela 3 só traz margem (± 2) para a acidose metabólica. Nas fórmulas respiratórias a ferramenta compara com ± 2 mEq/L, a tolerância do normal da Tabela 2 (p. 562) — é uma convenção da ferramenta, não do livro.'

// ---------------------------------------------------------------- ânion-gap (p. 564; p. 571)

/** AG = Na − (Cl + HCO3) (p. 564). Normal: 9 a 11 até 8 a 16 mEq/L, conforme o aparelho (p. 564). */
export function anionGap(na: number, cl: number, hco3: number): number | null {
  if (!positivo(na, cl) || !ok(hco3) || hco3 < 0) return null
  return na - (cl + hco3)
}

export const AG_TEXTO =
  'O valor normal do ânion-gap varia de 9–11 a 8–16 mEq/L, dependendo do aparelho (p. 564); o cap. 52 usa 12 ± 2 (p. 517). Na hipoalbuminemia o normal cai 2,5 a 3,5 mEq/L por 1 g/dL de albumina a menos (p. 564) — o livro não dá a albumina de referência, então a ferramenta não corrige.'

/** ΔAG/ΔHCO3 com o AG normal e o HCO3 normal escolhidos (p. 571). > 1,2 ou < 0,8: considerar distúrbio misto. */
export function razaoDelta(ag: number, hco3: number, agNormal: number, hco3Normal: number = NORMAL_TABELA2.hco3): { razao: number; texto: string } | null {
  if (!ok(ag, hco3, agNormal, hco3Normal)) return null
  const dAg = ag - agNormal
  const dHco3 = hco3Normal - hco3
  if (dHco3 <= 0) return null
  const razao = dAg / dHco3
  const texto =
    razao > 1.2
      ? 'Razão > 1,2: o livro sugere considerar distúrbio misto (alcalose metabólica ou acidose respiratória associada).'
      : razao < 0.8
        ? 'Razão < 0,8: o livro sugere considerar distúrbio misto (acidose hiperclorêmica ou alcalose respiratória associada).'
        : 'Razão entre 0,8 e 1,2: próxima da unidade, como na acidose com ânion-gap aumentado (p. 571).'
  return { razao, texto }
}

// ---------------------------------------------------------------- bicarbonato (p. 566)

/** Indicação geral: pH < 7,1 ou HCO3 < 8 mEq/L (p. 566). Na CAD o critério é outro (cap. 52). */
export function criterioBicarbonato(ph: number, hco3: number): boolean | null {
  if (!positivo(ph) || !ok(hco3) || hco3 < 0) return null
  return ph < 7.1 || hco3 < 8
}

/** mEq de HCO3 = (HCO3 desejado − HCO3 plasmático) × 0,3 × peso; HCO3 desejado = 15 (p. 566). */
export const HCO3_DESEJADO = 15

export function bicarbonatoMeq(pesoKg: number, hco3: number): number | null {
  if (!positivo(pesoKg) || !ok(hco3) || hco3 < 0 || hco3 >= HCO3_DESEJADO) return null
  return (HCO3_DESEJADO - hco3) * 0.3 * pesoKg
}

/** Bicarbonato a 1,4% (isosmolar): 0,17 mEq por mL; infusão em 1 a 2 h (p. 566). */
export const BIC14_MEQ_ML = 0.17

export const mlBic14 = (meq: number) => (positivo(meq) ? meq / BIC14_MEQ_ML : null)

export const ERRATA_BIC14 =
  'p. 566: "cada mL dessa solução contém 0,17 mEq/L de bicarbonato" — a unidade é mEq por mL (1,4 g/100 mL ÷ 84 mg/mEq ≈ 0,167 mEq/mL). O resultado da fórmula também está descrito como "mEq/L", mas é a quantidade em mEq.'

// ---------------------------------------------------------------- HCl (p. 567–568)

/** Alcalose grave (pH > 7,55 ou HCO3 > 40): HCl (mEq) = 0,5 × peso × (HCO3 plasmático − HCO3 desejado); máx. 0,2 mEq/kg/h; metade primeiro (p. 567–568). */
export function hclMeq(pesoKg: number, hco3: number, hco3Desejado: number): { total: number; metade: number; maxMeqH: number; horasMin: number } | null {
  if (!positivo(pesoKg, hco3, hco3Desejado) || hco3Desejado >= hco3) return null
  const total = 0.5 * pesoKg * (hco3 - hco3Desejado)
  const maxMeqH = 0.2 * pesoKg
  return { total, metade: total / 2, maxMeqH, horasMin: total / 2 / maxMeqH }
}

/** HCl 0,1 M = 100 mmol/L; 0,2 M = 200 mmol/L, em acesso central (p. 568). */
export const HCL_MMOL_L = { '0,1 M': 100, '0,2 M': 200 } as const

export const mlHcl = (meq: number, mmolL: number) => (positivo(meq, mmolL) ? (meq / mmolL) * 1000 : null)
