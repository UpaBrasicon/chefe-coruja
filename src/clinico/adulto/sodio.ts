import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto } from './fonte.ts'

// Distúrbios do sódio no adulto — cap. 66 do Manual de Medicina de Emergência
// do HCFMUSP (3ª ed., 2022), p. 882–899. Todo número tem página; a decisão é
// do profissional (ADR 0007): aqui só se calcula e se mostra o que o manual traz.

// Revisão PubMed de 09/10/2026 (decisão do RT): o teto de 8 mEq/L em 24 h na
// crônica continua; entra o alerta contra a subcorreção, pela metanálise do
// JAMA Intern Med 2025 (coortes, certeza moderada a baixa).
export const META_CORRECAO_HIPONATREMIA_2025: Fonte = {
  citacao: 'Ayus JC, Moritz ML, Fuentes NA, et al. Correction Rates and Clinical Outcomes in Hospitalized Adults With Severe Hyponatremia: A Systematic Review and Meta-Analysis. JAMA Intern Med. 2025;185(1):38–51 (PMID 39556338).',
  url: 'https://doi.org/10.1001/jamainternmed.2024.5981',
}

export const ALERTA_SUBCORRECAO = 'Corrigir devagar demais também faz mal. Na metanálise do JAMA Intern Med 2025 (16 coortes, 11.811 pacientes com sódio < 120, ou < 125 com sintomas graves), a correção lenta (< 8 mEq/L/24 h) e muito lenta (< 4–6 mEq/L/24 h) se associou a mais mortes e internação mais longa que a correção rápida (≥ 8–10 mEq/L/24 h), sem aumento significativo de desmielinização osmótica. São estudos observacionais (certeza moderada a baixa). O teto do manual (8 mEq/L em 24 h na crônica) continua; o alerta é para não ficar muito abaixo dele.'

const fichaHiponaLivro = fichaAdulto('adulto-hiponatremia', 'Hiponatremia — NaCl 3% pelo manual', 'cap. 66, p. 882–891')
export const fichaHiponatremia: Ficha = {
  ...fichaHiponaLivro,
  versao: '2026-10-09.1',
  fontes: [...fichaHiponaLivro.fontes, META_CORRECAO_HIPONATREMIA_2025],
  revisadoEm: '09/10/2026 (alerta contra a subcorreção, JAMA Intern Med 2025)',
}
export const fichaHipernatremia = fichaAdulto('adulto-hipernatremia', 'Hipernatremia — água livre e Adrogué-Madias', 'cap. 66, p. 892–899')

const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x))
const positivo = (...xs: number[]) => ok(...xs) && xs.every((x) => x > 0)

// ---------------------------------------------------------------- sódio corrigido

/**
 * Sódio corrigido pela glicemia: +1,6 mEq/L a cada 100 mg/dL acima de 100
 * (p. 883, 886 e 896). Com glicemia ≤ 100 não há correção.
 */
export function sodioCorrigido(na: number, glicemia: number): number | null {
  if (!positivo(na, glicemia)) return null
  return glicemia <= 100 ? na : na + (1.6 * (glicemia - 100)) / 100
}

export const ERRATA_SODIO_CORRIGIDO =
  'Na p. 869 a fórmula aparece como "Na medido + 1,6 × glicemia medida – 100", sem parênteses nem divisão por 100 (daria ~1.500 mEq/L). A conta segue a regra do próprio manual nas p. 883, 886 e 896: +1,6 mEq/L a cada 100 mg/dL de glicemia acima de 100.'

// ---------------------------------------------------------------- hiponatremia

export type Tonicidade = 'hipertonica' | 'isotonica' | 'hipotonica'

/** Classificação pela osmolaridade sérica (p. 883). */
export function tonicidade(osm: number): Tonicidade | null {
  if (!positivo(osm)) return null
  if (osm > 295) return 'hipertonica'
  if (osm >= 280) return 'isotonica'
  return 'hipotonica'
}

export const TONICIDADE_TEXTO: Record<Tonicidade, string> = {
  hipertonica: 'Hipertônica (> 295 mOsm/L): hiperglicemia, manitol/glicose hipertônica, álcool',
  isotonica: 'Isotônica (280–295 mOsm/L): pseudo-hiponatremia (proteínas, triglicerídeos)',
  hipotonica: 'Hipotônica (< 280 mOsm/L): subdividir pela volemia',
}

export type GravidadeHipo = 'leve' | 'moderada' | 'grave'

/** Leve 130–134, moderada 120–129, grave < 120 mEq/L (p. 888). ≥ 135 não é hiponatremia (p. 882). */
export function gravidadeHiponatremia(na: number): GravidadeHipo | null {
  if (!positivo(na) || na >= 135) return null
  if (na >= 130) return 'leve'
  if (na >= 120) return 'moderada'
  return 'grave'
}

/** Preparo do NaCl 3% (p. 889): 445 mL de SF + 55 mL de NaCl 20% = 500 mL. */
export const SALINA_3 = { sfMl: 445, nacl20Ml: 55, totalMl: 500, pagina: 'p. 889' }

/** % de NaCl do preparo (g/100 mL), a partir das duas soluções do livro (0,9% e 20%). */
export function concentracaoPreparoSalina3(): number {
  const gramas = SALINA_3.sfMl * 0.009 + SALINA_3.nacl20Ml * 0.2
  return (gramas / SALINA_3.totalMl) * 100
}

/** "A cada 1 mL/kg de NaCl 3% infundida, o sódio sérico se eleva em 1 mEq/L" (p. 889). */
export function mlSalina3ParaElevar(pesoKg: number, elevacao: number): number | null {
  if (!positivo(pesoKg) || !ok(elevacao) || elevacao < 0) return null
  return pesoKg * elevacao
}

export function elevacaoEstimadaSalina3(pesoKg: number, ml: number): number | null {
  if (!positivo(pesoKg) || !ok(ml) || ml < 0) return null
  return ml / pesoKg
}

export const LIMITES_HIPONATREMIA = {
  /** crônica: aumento não deve ultrapassar 8 mEq/L nas primeiras 24 h (Tabela 5, p. 890) */
  cronicaMax24h: 8,
  /** crônica em infusão: ajustar para 4–6 mEq/L nas 24 h; parar em 125 (Tabela 5, p. 890–891) */
  cronicaAlvo24h: [4, 6] as [number, number],
  pararEm: 125,
  /** aguda: elevar 4–6 mEq/L nas primeiras horas (p. 889; Tabela 4, p. 890) */
  agudaAlvo: [4, 6] as [number, number],
  /** infusão de NaCl 3% na crônica (Tabela 5, p. 890) */
  infusaoMlH: [15, 30] as [number, number],
  /** bolus: 100 mL (sintomático) / 50 mL (aguda assintomática sem autocorreção); máximo 300 mL (Tabelas 4 e 5, p. 890) */
  bolusMl: 100,
  bolusAssintomaticoMl: 50,
  bolusMaxMl: 300,
}

export type CenarioHipo =
  | 'aguda-sintomatica'
  | 'aguda-assintomatica'
  | 'cronica-grave'
  | 'cronica-edemaciado'
  | 'cronica-sintomatico'
  | 'cronica-assintomatico'

export type LinhaConduta = { cenario: string; manual: string[]; pagina: string }

/** Linhas das Tabelas 4 e 5 (p. 889–891), como o manual traz. */
export const CONDUTA_HIPONATREMIA: Record<CenarioHipo, LinhaConduta> = {
  'aguda-sintomatica': {
    cenario: 'Aguda (< 48 h), sintomática',
    manual: ['Bolus de 100 mL de NaCl 3% até sintomas resolvidos', 'Dose máxima 300 mL', 'Repetir sódio sérico 1/1 h', 'Objetivo: aumento de 4 a 6 mEq no sódio sérico nas primeiras horas', 'Repetir bolus se nova queda'],
    pagina: 'Tabela 4, p. 889–890',
  },
  'aguda-assintomatica': {
    cenario: 'Aguda (< 48 h), assintomática',
    manual: ['Autocorrigindo por diurese osmótica? Sim → dosar sódio 1/1 h até autocorreção', 'Não → bolus 50 mL de NaCl 3%', 'Dosar sódio 1/1 h e repetir bolus se nova queda'],
    pagina: 'Tabela 4, p. 890',
  },
  'cronica-grave': {
    cenario: 'Crônica, sintomas graves ou sintomático com patologia do SNC (qualquer sódio)',
    manual: ['Bolus de 100 mL de NaCl 3% até sintomas resolvidos', 'Dose máxima 300 mL', 'Dosar sódio 1/1 h; repetir bolus se nova queda', 'O aumento do sódio não deve ultrapassar 8 mEq/L nas primeiras 24 h'],
    pagina: 'Tabela 5, p. 890',
  },
  'cronica-edemaciado': {
    cenario: 'Crônica, Na < 120 em edemaciado (cirrose, IC, nefrótico)',
    manual: ['NaCl 3% 15 a 30 mL/h + furosemida 40 mg IV 2×/d', 'Dosar sódio 4/4 h', 'Ajustar a infusão para elevação de 4 a 6 mEq/L nas 24 h', 'Titular diurético para evitar congestão', 'Parar correção quando sódio atingir 125 mEq/L'],
    pagina: 'Tabela 5, p. 890',
  },
  'cronica-sintomatico': {
    cenario: 'Crônica, Na < 120, sintomático',
    manual: ['NaCl 3% 15 a 30 mL/h', 'Dosar sódio 4/4 h', 'Ajustar a infusão para elevação de 4 a 6 mEq/L nas 24 h', 'Parar correção quando sódio atingir 125 mEq/L'],
    pagina: 'Tabela 5, p. 890–891',
  },
  'cronica-assintomatico': {
    cenario: 'Crônica, Na < 120, assintomático',
    manual: ['Internação hospitalar', 'Dosar sódio 12/12 h', 'Medidas gerais'],
    pagina: 'Tabela 5, p. 891',
  },
}

export const ERRATA_HIPONATREMIA =
  'Na p. 889 o texto diz "50–300 mL de salina hipertônica usualmente a 20%", em alíquotas de 50–100 mL "(máximo de 150 mL)". O preparo da mesma página e as Tabelas 4 e 5 (p. 890) usam NaCl 3%, bolus de 100 mL (50 mL na aguda assintomática) e máximo de 300 mL: a ferramenta segue as tabelas.'

// ---------------------------------------------------------------- hipernatremia

export type Sexo = 'masculino' | 'feminino'

/** ACT = peso × 0,6 (♂) ou 0,5 (♀); idoso 0,5 (♂) ou 0,45 (♀) (p. 897). O manual não define a idade de "idoso". */
export function fatorAguaCorporal(sexo: Sexo, idoso: boolean): number {
  if (idoso) return sexo === 'masculino' ? 0.5 : 0.45
  return sexo === 'masculino' ? 0.6 : 0.5
}

export function aguaCorporalTotal(pesoKg: number, sexo: Sexo, idoso: boolean): number | null {
  if (!positivo(pesoKg)) return null
  return pesoKg * fatorAguaCorporal(sexo, idoso)
}

/** Déficit de água livre (L) = [(Na − 140)/140] × ACT (p. 897). */
export function deficitAguaLivre(na: number, act: number): number | null {
  if (!positivo(na, act)) return null
  return ((na - 140) / 140) * act
}

/** Adrogué-Madias: variação do Na por litro infundido = (Na sérico − Na da solução)/(ACT + 1) (p. 898). */
export function variacaoPorLitro(na: number, naSolucao: number, act: number): number | null {
  if (!positivo(na, act) || !ok(naSolucao) || naSolucao < 0) return null
  return (na - naSolucao) / (act + 1)
}

export const ERRATA_ADROGUE =
  'Na p. 898 a fórmula está impressa como "(sódio sérico – sódio solução) / ACT + 1", sem parênteses no denominador. O exemplo do próprio livro (1 L de G5%, homem de 70 kg, Na 160 → queda de 3,7 mEq/L) só fecha com divisão por (ACT + 1).'

export type SolucaoHiper = { id: string; nome: string; naMeqL: number; aguaLivreLporL: number | null; pagina: string }

/** Soluções citadas no manual, com Na e água livre por litro (p. 897–898). */
export const SOLUCOES_HIPERNATREMIA: SolucaoHiper[] = [
  { id: 'g5', nome: 'Glicose 5%', naMeqL: 0, aguaLivreLporL: 1, pagina: 'p. 898' },
  { id: 'sal045', nome: 'Salina 0,45%', naMeqL: 77, aguaLivreLporL: 0.5, pagina: 'p. 898' },
  { id: 'sal0225', nome: 'Salina 0,225%', naMeqL: 38, aguaLivreLporL: 0.75, pagina: 'p. 898' },
  { id: 'sf', nome: 'SF 0,9% (expansão no hipovolêmico)', naMeqL: 154, aguaLivreLporL: null, pagina: 'p. 897' },
]

/** Litros da solução para uma variação desejada, pela estimativa de Adrogué-Madias (linear, só estimativa — p. 898). */
export function litrosParaReducao(reducao: number, porLitro: number): number | null {
  if (!ok(reducao, porLitro) || reducao <= 0 || porLitro <= 0) return null
  return reducao / porLitro
}

/** Litros da solução que contêm o déficit de água livre (água livre por litro, p. 898). */
export function litrosParaDeficit(deficitL: number, solucao: SolucaoHiper): number | null {
  if (!ok(deficitL) || deficitL <= 0 || !solucao.aguaLivreLporL) return null
  return deficitL / solucao.aguaLivreLporL
}

export const LIMITES_HIPERNATREMIA = {
  /** crônica (> 48 h): variação nas primeiras 24 h não pode ultrapassar 8–10 mEq/L (p. 898) */
  cronicaMax24h: [8, 10] as [number, number],
  /** aguda: 1 mEq/L/h nas primeiras 6 a 8 horas (p. 898) */
  agudaPorHora: 1,
  agudaHoras: [6, 8] as [number, number],
  /** dosar sódio a cada 4–6 h durante a reposição (p. 898) */
  dosarHoras: [4, 6] as [number, number],
  /** hipernatremia: Na > 145 (p. 892) */
  definicao: 145,
}
