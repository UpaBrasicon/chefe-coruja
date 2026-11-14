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

// Lote 3 da revisão do HCFMUSP, N2 (decisão do RT de 14/11/2026), cap. 66: a
// diretriz europeia de 2014 (ESICM, ESE e ERA-EDTA) foi lida no texto integral,
// com os graus GRADE (1 = recomenda, 2 = sugere; A–D = qualidade). O "treatment
// standard" da ERA de 2024 também foi lido: é uma revisão de um autor, sem
// graduação, e entra como complemento. As contas e doses do manual não mudam.
export const EUROPEIA_HIPONATREMIA_2014: Fonte = {
  citacao: 'Spasovski G, Vanholder R, Allolio B, et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia (ESICM, ESE e ERA-EDTA/ERBP). Eur J Endocrinol. 2014;170(3):G1–G47 (PMID 24569125). Texto integral lido, com os graus de cada recomendação.',
  url: 'https://doi.org/10.1530/EJE-13-1020',
}

export const ERA_HIPONATREMIA_2024: Fonte = {
  citacao: 'Spasovski G. Hyponatraemia—treatment standard 2024. Nephrol Dial Transplant. 2024;39(10):1583–1592 (PMID 39009016). Revisão de um autor, sem graduação das recomendações. Texto integral lido.',
  url: 'https://doi.org/10.1093/ndt/gfae162',
}

const SEM_ITEM_SODIO = 'sem item do manual na ferramenta'

/** Europeia 2014 (graduada) e ERA 2024 (revisão) × manual, na hiponatremia; um tema por linha. */
export const DIRETRIZ_HIPONATREMIA: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Sódio corrigido pela glicemia', diretriz: 'Excluir a hiponatremia por hiperglicemia: medir a glicemia e corrigir o sódio medido se ela estiver alta', grau: '1D', fonte: 'Europeia 2014', livro: '+1,6 mEq/L a cada 100 mg/dL acima de 100 (p. 883, 886, 896)' },
  { tema: 'Sintomas graves: primeira hora', diretriz: 'Aguda ou crônica: 150 mL de NaCl 3% EV em 20 min (1D); dosar o sódio em 20 min e repetir 150 mL (2D); repetir até duas vezes ou até subir 5 mmol/L (2D)', grau: '1D e 2D', fonte: 'Europeia 2014', livro: 'bolus de 100 mL de NaCl 3% até os sintomas resolverem, máximo de 300 mL; sódio de 1/1 h; alvo de 4–6 mEq/L nas primeiras horas (Tabelas 4 e 5, p. 889–890)' },
  { tema: 'Sintomas graves que melhoram com +5', diretriz: 'Parar a salina hipertônica; manter a veia com o menor volume possível de SF 0,9%; tratar a causa (1D). Limite: +10 mmol/L nas primeiras 24 h e +8 a cada 24 h depois, até 130 (1D). Sódio em 6 h, 12 h e depois diário (2D)', grau: '1D e 2D', fonte: 'Europeia 2014', livro: 'crônica: não passar de 8 mEq/L nas primeiras 24 h (Tabela 5, p. 890)' },
  { tema: 'Sintomas graves sem melhora com +5', diretriz: 'Manter NaCl 3% para subir mais 1 mmol/L por hora; parar quando os sintomas melhorarem, o sódio subir 10 no total ou chegar a 130, o que vier antes; procurar outra causa (1D). Sódio de 4/4 h durante a infusão (2D)', grau: '1D e 2D', fonte: 'Europeia 2014', livro: 'repetir o bolus se nova queda; máximo de 300 mL (Tabelas 4 e 5, p. 890)' },
  { tema: 'Sintomas moderadamente graves', diretriz: '150 mL de NaCl 3% EV em 20 min, dose única; alvo de +5 mmol/L em 24 h; limite de +10 nas primeiras 24 h e +8 depois; sódio em 1, 6 e 12 h', grau: '2D', fonte: 'Europeia 2014', livro: 'crônica com Na < 120 e sintomas: NaCl 3% 15–30 mL/h, sódio de 4/4 h, alvo de 4–6 mEq/L em 24 h, parar em 125 (Tabela 5, p. 890–891)' },
  { tema: 'Aguda sem sintomas graves', diretriz: 'Se a queda aguda passar de 10 mmol/L: 150 mL de NaCl 3% EV em 20 min, dose única; sódio em 4 h', grau: '2D', fonte: 'Europeia 2014', livro: 'autocorrigindo por diurese osmótica: sódio de 1/1 h; se não, bolus de 50 mL de NaCl 3% (Tabela 4, p. 890)' },
  { tema: 'Crônica sem sintomas graves', diretriz: 'Leve: não tratar só para subir o sódio (2C). Moderada ou profunda: não passar de +10 mmol/L nas primeiras 24 h e +8 depois (1D); sódio de 6/6 h até estabilizar (2D)', grau: '2C, 1D e 2D', fonte: 'Europeia 2014', livro: 'Na < 120 sem sintomas: internar, sódio de 12/12 h, medidas gerais (Tabela 5, p. 891)' },
  { tema: 'Edemaciado (volume extracelular aumentado)', diretriz: 'Leve ou moderada: não tratar só para subir o sódio (1C); restringir líquidos (2D); não usar antagonista do receptor de vasopressina (1C)', grau: '1C e 2D', fonte: 'Europeia 2014', livro: 'Na < 120 no edemaciado: NaCl 3% 15–30 mL/h e furosemida 40 mg EV 2 vezes ao dia; parar em 125 (Tabela 5, p. 890)' },
  { tema: 'SIADH', diretriz: 'Moderada ou profunda: restrição hídrica como primeira linha; na segunda linha, equivalentes: ureia 0,25–0,50 g/kg/dia ou diurético de alça em dose baixa com NaCl VO (2D). Antagonista de vasopressina: não recomendado na moderada e contraindicado na profunda (1C)', grau: '2D e 1C', fonte: 'Europeia 2014', livro: SEM_ITEM_SODIO },
  { tema: 'Volume circulante reduzido', diretriz: 'Repor o volume com SF 0,9% ou cristaloide balanceado a 0,5–1,0 mL/kg/h', grau: '1B', fonte: 'Europeia 2014', livro: SEM_ITEM_SODIO },
  { tema: 'Correção rápida demais', diretriz: 'Baixar de novo o sódio se subir > 10 mmol/L nas primeiras 24 h ou > 8 em 24 h depois; suspender o tratamento ativo (1D). Com especialista: água livre 10 mL/kg (p. ex., glicose) em 1 h, com controle de diurese, e desmopressina 2 µg EV, no mínimo a cada 8 h (1D)', grau: '1D', fonte: 'Europeia 2014', livro: SEM_ITEM_SODIO },
  { tema: 'Bolus ou infusão contínua', diretriz: 'NaCl 3% 100–150 mL (2–4 mL/kg) em 20–40 min, repetido até o alvo, ou infusão contínua de 0,5–1 mL/kg/h. O bolus intermitente é o preferido no sintomático; a comparação ainda é discutida', grau: 'revisão, sem graduação', fonte: 'ERA 2024', livro: 'bolus de 100 mL; máximo de 300 mL (Tabelas 4 e 5, p. 890)' },
  { tema: 'Alvo das primeiras horas', diretriz: 'Na aguda ou grave com sintomas: subir 4–6 mmol/L nas primeiras 6 h ou menos e manter esse ganho nas 24 h; nunca passar de 8 mmol/L em 24 h', grau: 'revisão, sem graduação', fonte: 'ERA 2024', livro: '4–6 mEq/L nas primeiras horas; crônica até 8 mEq/L em 24 h (Tabelas 4 e 5, p. 889–890)' },
  { tema: 'Hipocalemia junto', diretriz: 'Preferir a infusão contínua de NaCl 3%, que permite somar KCl; o potássio também sobe o sódio, então dosar o sódio de 2/2 h', grau: 'revisão, sem graduação', fonte: 'ERA 2024', livro: SEM_ITEM_SODIO },
  { tema: 'Resgate da hipercorreção', diretriz: 'Parar o que corrige; glicose 5% 2–4 mL/kg/h por 4 h e/ou desmopressina 1–3 µg EV ou SC a cada 8–12 h, com sódio seriado', grau: 'revisão, sem graduação', fonte: 'ERA 2024', livro: SEM_ITEM_SODIO },
  { tema: 'Segunda linha no SIADH', diretriz: 'Ureia e tolvaptana são as mais eficazes; ureia 0,25–0,5 g/kg/dia (15–30 g/dia). Tolvaptana começa com 7,5 mg, com vigilância de hipercorreção', grau: 'revisão, sem graduação', fonte: 'ERA 2024', livro: SEM_ITEM_SODIO },
]

export const DIFERENCAS_HIPONATREMIA: string[] = [
  'Bolus nos sintomas graves: a europeia de 2014 dá 150 mL de NaCl 3% em 20 min, até duas repetições ou +5 mmol/L; a ERA 2024, 100–150 mL (2–4 mL/kg); o manual, 100 mL até 300 mL.',
  'Limite em 24 h: a europeia de 2014 aceita até +10 mmol/L nas primeiras 24 h e +8 depois; o manual e a ERA 2024 usam 8 em 24 h na crônica. A ferramenta segue alertando contra corrigir devagar demais (JAMA Intern Med 2025).',
  'Quando parar: a europeia para a salina hipertônica quando os sintomas melhoram, o sódio sobe 10 ou chega a 130; o manual para a infusão da crônica em 125.',
  'Edemaciado: a europeia de 2014 não trata só para subir o sódio na leve ou moderada, restringe líquidos e não usa vaptana; o manual usa NaCl 3% 15–30 mL/h com furosemida no Na < 120.',
  'Hipercorreção: as duas diretrizes trazem o resgate (água livre ou glicose 5% e desmopressina); o manual não traz.',
  'Vaptana no SIADH: a europeia de 2014 não a recomenda (1C); a ERA 2024 põe tolvaptana e ureia como a segunda linha mais eficaz.',
]

const fichaHiponaLivro = fichaAdulto('adulto-hiponatremia', 'Hiponatremia — NaCl 3% pelo manual', 'cap. 66, p. 882–891')
export const fichaHiponatremia: Ficha = {
  ...fichaHiponaLivro,
  versao: '2026-11-14.1',
  fontes: [...fichaHiponaLivro.fontes, META_CORRECAO_HIPONATREMIA_2025, EUROPEIA_HIPONATREMIA_2014, ERA_HIPONATREMIA_2024],
  revisadoEm: '14/11/2026 (europeia 2014 e ERA 2024 lidas no texto integral, ao lado do manual; lote 3 da revisão do HCFMUSP; aguarda aprovação do RT); 09/10/2026 (alerta contra a subcorreção, JAMA Intern Med 2025)',
}
// Revisão PubMed, itens médios (decisão do RT de 06/11/2026, H8 = A): a
// metanálise da velocidade de correção da hipernatremia entra só como nota. O
// limite do manual (crônica até 8–10 mEq/L em 24 h; aguda 1 mEq/L/h por 6–8 h)
// continua e segue no alerta da tela.
export const HIPERNATREMIA_CORRECAO_2025: Fonte = {
  citacao: 'Kitisin N, Raykateeraroj N, Hikasa Y, et al. Systematic review and meta-analysis of the treatment of hypernatremia in adult hospitalized patients: impact on mortality, morbidity, and treatment-related side effects. J Crit Care. 2025;87:155012 (PMID 39765195).',
  url: 'https://doi.org/10.1016/j.jcrc.2024.155012',
}

export const NOTA_HIPERNATREMIA_VELOCIDADE =
  'Metanálise de 2025 (J Crit Care; 12 estudos em adultos internados), posterior ao livro: no conjunto, corrigir mais rápido que 0,5 mmol/L/h não mudou a mortalidade (heterogeneidade alta). Nos subgrupos, a correção mais rápida se associou a menos mortes na hipernatremia já presente na internação, quando feita nas primeiras 24 h do diagnóstico e na forma grave; não houve complicação neurológica maior relatada com velocidade abaixo de 1 mmol/L/h. O limite do manual (crônica até 8–10 mEq/L em 24 h; aguda 1 mEq/L/h nas primeiras 6–8 h) continua.'

const fichaHipernaLivro = fichaAdulto('adulto-hipernatremia', 'Hipernatremia — água livre e Adrogué-Madias', 'cap. 66, p. 892–899')
export const fichaHipernatremia: Ficha = {
  ...fichaHipernaLivro,
  versao: '2026-11-06.1',
  fontes: [...fichaHipernaLivro.fontes, HIPERNATREMIA_CORRECAO_2025],
  revisadoEm: '06/11/2026 (nota da velocidade de correção, J Crit Care 2025; revisão PubMed, itens médios)',
}

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
