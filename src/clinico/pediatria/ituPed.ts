import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP4, type DoseLivro } from './fonteP4.ts'

// Infecção urinária — livro do ICr, cap. 57 (p. 588–601). Limiares de
// urocultura e de leucocitúria por método de coleta, antibióticos orais
// (Tabela 3) e parenterais (Tabela 4) por peso. Máximos que o capítulo não traz
// vêm do Apêndice (p. 897–910). O capítulo não dá dose para o recém-nascido
// ("associa-se ampicilina", sem dose): RN bloqueado.

// Revisão PubMed de 09/10/2026 (decisão do RT): a diretriz da AAP de out/2026
// (8 dias a 5 anos) substitui a de 2011 que o livro cita. Em 11/11/2026 o RT
// trouxe os PDFs (diretriz e relatório técnico do diagnóstico) e decidiu, a
// partir de docs/clinico/ITU-AAP-2026-DIAGNOSTICO.md: I1–I6 = A (limiares da
// AAP 2026 de 8 dias a 5 anos; até 7 dias e acima de 5 anos, o livro);
// I7–I10 = B (nota ao lado da linha do livro, sem dose); I11–I13 = C.
// Páginas: "CPG" é a diretriz (PMID 42803578); "RT-diag" é o relatório técnico
// do diagnóstico (PMID 42803592).
export const AAP_ITU_2026: Fonte = {
  citacao: 'Alverson BK, Hains DS, Downs SM, et al. Clinical Practice Guideline for the Diagnosis and Treatment of Urinary Tract Infection in Children From 8 Days to 5 Years of Age. Pediatrics. 2026;158(4) (PMID 42803578).',
  url: 'https://doi.org/10.1542/peds.2026-078565',
}
export const AAP_ITU_2026_DIAGNOSTICO: Fonte = {
  citacao: 'Forster CS, Nelson C, El Feghaly R, et al. Urinary Tract Infection Diagnosis — A Companion to the AAP 2026 Clinical Practice Guideline: Technical Report. Pediatrics. 2026;158(4) (PMID 42803592).',
  url: 'https://doi.org/10.1542/peds.2026-078566',
}
export const AAP_ITU_2026_MANEJO: Fonte = {
  citacao: 'AlShenaiber L, Senerth E, Babatunde I, et al. A Systematic Review and Meta-Analysis of the Prevention and Management of Pediatric Urinary Tract Infection and Suspected Urinary Tract Infection: Technical Report. Pediatrics. 2026;158(4) (PMID 42803594).',
  url: 'https://doi.org/10.1542/peds.2026-078568',
}

export const AVISO_AAP_2026: string[] = [
  'A AAP publicou em out/2026 diretriz nova para 8 dias a 5 anos, em criança sem complexidade médica, que substitui a de 2011 citada pelo livro (inclusive a Tabela 2). Os números foram lidos no texto integral em 11/11/2026.',
  'De 8 dias a 5 anos a ferramenta aplica a AAP 2026: urocultura por sonda ou punção positiva com ≥ 10.000 UFC/mL de um uropatógeno (era 50.000 na AAP de 2011); jato médio ≥ 100.000 UFC/mL só a partir de 2 meses; piúria obrigatória, com limiar pela idade e conforme a urocultura esteja pendente ou pronta (Tabela 1, CPG p. 5). Até 7 dias e acima de 5 anos (até 13a 11m 29d) continuam os valores do livro.',
  'A AAP tirou a raça da avaliação de risco (CPG p. 5): a Tabela 2 do livro, com etnia e contagem de fatores, saiu da ferramenta.',
  'Fora do público da diretriz (CPG p. 1 e 4): bexiga neurogênica, imunodepressão, prematuridade extrema, anomalia congênita conhecida do rim e das vias urinárias, outras anomalias congênitas maiores, doença multissistêmica e doença crônica grave.',
  'Tratamento (revisão sistemática, certeza baixa a muito baixa): curso de 7 dias ou menos parece não aumentar recorrência e reduz efeitos adversos; via oral parece tão eficaz quanto parenteral ou parenteral seguida de oral; profilaxia contínua no refluxo não mostrou menos ITU de escape nem menos cicatriz e pode aumentar resistência; avaliação em até 72 h do início dos sintomas se associou a menos cicatriz renal.',
  'Dose nenhuma muda: as doses abaixo continuam as do livro. A AAP não traz dose. Recém-nascido de até 7 dias está fora da diretriz.',
]

const fichaItuLivro = fichaP4('ped-infeccao-urinaria', 'Infecção urinária — criança', 'cap. 57, p. 588–601; Apêndice, p. 898–909')
export const fichaItuPed: Ficha = {
  ...fichaItuLivro,
  versao: '2026-11-11.1',
  fontes: [...fichaItuLivro.fontes, AAP_ITU_2026, AAP_ITU_2026_DIAGNOSTICO, AAP_ITU_2026_MANEJO],
  revisadoEm: '11/11/2026 (limiares da AAP 2026 de 8 dias a 5 anos: urocultura, piúria pela Tabela 1 e quem testar pela Figura 2, sem etnia; notas da AAP ao lado da duração, da via e da escolha empírica, sem dose; decisão do RT, I1–I6 = A, I7–I10 = B, I11–I13 = C); 09/10/2026 (aviso da diretriz AAP 2026)',
}

/**
 * Faixa de idade que decide a referência (decisão do RT, 11/11/2026): de 8 dias
 * a 5 anos, AAP 2026; até 7 dias e acima de 5 anos, o livro. As linhas da
 * Tabela 1 da AAP são "0 a < 2 meses" e "2 meses a 5 anos" (CPG p. 5); a
 * diretriz começa em 8 dias.
 */
export type FaixaItu = 'ate7d' | '8d_2m' | '2m_5a' | 'acima5a'

export const FAIXAS_ITU: [FaixaItu, string][] = [
  ['ate7d', 'Até 7 dias'],
  ['8d_2m', '8 dias a < 2 meses'],
  ['2m_5a', '2 meses a 5 anos'],
  ['acima5a', 'Acima de 5 anos'],
]

export const usaAap = (f: FaixaItu) => f === '8d_2m' || f === '2m_5a'

export const REFERENCIA_AAP = 'AAP 2026 (8 dias a 5 anos)'
export const REFERENCIA_LIVRO = 'Livro do ICr (até 7 dias ou acima de 5 anos)'

/**
 * A faixa marcada bate com a idade digitada? Só confere quando há idade ou o
 * campo de recém-nascido marcado; aos 5 anos completos as duas faixas de cima
 * são aceitas (a ferramenta não decide o limite de 5 anos por conta própria).
 */
export function faixaCompativel(faixa: FaixaItu, anos: number, meses: number, rn: boolean): boolean {
  const a = Number.isFinite(anos) ? anos : 0
  const m = Number.isFinite(meses) ? meses : 0
  if (a === 0 && m === 0 && !rn) return true
  const totalMeses = a * 12 + m
  switch (faixa) {
    case 'ate7d': return a === 0 && m === 0
    case '8d_2m': return a === 0 && m <= 1
    case '2m_5a': return !rn && totalMeses >= 2 && a <= 5
    case 'acima5a': return !rn && a >= 5
  }
}

// ---------------------------------------------------------------------------
// Quem testar — AAP 2026, Figura 2 (CPG p. 28). Sem raça e sem número mínimo.

export const FIGURA2_ENTRADA = '2 a 24 meses com febre ≥ 39 °C, bom estado geral e sem foco aparente (CPG Figura 2, p. 28).'
export const FATORES_FIGURA2: string[] = ['Menos de 12 meses', 'Menina', 'Menino não circuncidado', 'ITU prévia', 'Sem outra fonte de febre', 'Febre ≥ 48 h']
export const NOTA_FIGURA2 =
  'A Figura 2 não dá número mínimo de fatores: pesar os fatores ou usar o UTICalc, citado na própria figura (p. 28); a decisão de testar é do médico. A raça saiu da avaliação de risco (CPG p. 5), e com ela a contagem da Tabela 2 do livro, cujos cortes foram feitos com a etnia dentro.'
export const NOTA_FIGURA1 =
  '8 a 60 dias (Figura 1, CPG p. 27): febre ≥ 38,0 °C; menos de 22 dias vai direto para urocultura por sonda e antibiótico, como na diretriz do lactente febril.'

// ---------------------------------------------------------------------------
// Urinálise — AAP 2026, Tabela 1 (CPG p. 5; RT-diag p. 2).

/** Leucócitos por campo de grande aumento, em urina não centrifugada; faixas pelos cortes da Tabela 1 (5 e 10). */
export type Leucocitos = 'nao_feita' | 'lt5' | '5a9' | 'ge10'
export type Esterase = 'nao_feita' | 'negativa' | 'tracos' | '1+' | '2+'
export type Urinalise = { leucocitos: Leucocitos; esterase: Esterase }
export const SEM_URINALISE: Urinalise = { leucocitos: 'nao_feita', esterase: 'nao_feita' }

export const OPCOES_LEUCOCITOS: [Leucocitos, string][] = [['nao_feita', 'Não feita'], ['lt5', '< 5'], ['5a9', '5 a 9'], ['ge10', '≥ 10']]
export const OPCOES_ESTERASE: [Esterase, string][] = [['nao_feita', 'Não feita'], ['negativa', 'Negativa'], ['tracos', 'Traços'], ['1+', '1+'], ['2+', '≥ 2+']]

const NIVEL_LEUC: Record<Exclude<Leucocitos, 'nao_feita'>, number> = { lt5: 0, '5a9': 5, ge10: 10 }
const NIVEL_EST: Record<Exclude<Esterase, 'nao_feita'>, number> = { negativa: 0, tracos: 1, '1+': 2, '2+': 3 }

type Limiar = { leuc: 5 | 10; est: 'tracos' | '1+' | '2+'; texto: string }

/** Tabela 1 (CPG p. 5): "ITU provável, urocultura pendente" e "inflamação, urocultura pronta" (qualquer coleta). */
export const TABELA1_AAP: Record<'8d_2m' | '2m_5a', { provavel: Limiar; inflamacao: Limiar }> = {
  '8d_2m': {
    provavel: { leuc: 5, est: 'tracos', texto: '≥ 5 leucócitos/campo ou esterase ≥ traços' },
    inflamacao: { leuc: 5, est: 'tracos', texto: '≥ 5 leucócitos/campo ou esterase ≥ traços' },
  },
  '2m_5a': {
    provavel: { leuc: 10, est: '2+', texto: '≥ 10 leucócitos/campo ou esterase ≥ 2+' },
    inflamacao: { leuc: 5, est: '1+', texto: '≥ 5 leucócitos/campo ou esterase ≥ 1+' },
  },
}

export const NOTA_CONTAGEM_AAP =
  'Leucócitos por campo de grande aumento em urina não centrifugada (RT-diag p. 4 e 6). Não se convertem para o "/campo em urina centrifugada" nem para o "/mm³" do livro.'
export const NOTA_LIMIARES_AAP =
  'Os limiares da urinálise são apoio à decisão, não regra absoluta: com probabilidade pré-teste alta (lactente com aspecto de doente), pode-se colher urocultura e tratar mesmo com urinálise duvidosa; com probabilidade baixa, urinálise duvidosa ajuda a excluir (nota "a" da Tabela 1, CPG p. 5).'
export const NOTA_NITRITO =
  'Nitrito: baixa sensibilidade e alta especificidade; mostra bactéria, não inflamação, e não separa bacteriúria assintomática de ITU (CPG p. 13; RT-diag p. 5).'

/** 'sim': algum exame feito atinge o limiar; 'nao': os dois feitos e nenhum atinge; 'parcial': o feito não atinge e o outro não foi feito. */
export type Criterio = 'sim' | 'nao' | 'parcial'

function atinge(u: Urinalise, l: Limiar): Criterio | null {
  const leuc = u.leucocitos === 'nao_feita' ? null : NIVEL_LEUC[u.leucocitos] >= l.leuc
  const est = u.esterase === 'nao_feita' ? null : NIVEL_EST[u.esterase] >= NIVEL_EST[l.est]
  if (leuc === null && est === null) return null
  if (leuc === true || est === true) return 'sim'
  return leuc === false && est === false ? 'nao' : 'parcial'
}

/** Piúria pela Tabela 1, na faixa da AAP. null fora da faixa ou sem urinálise. */
export function piuriaAap(faixa: FaixaItu, u: Urinalise): { provavel: Criterio; inflamacao: Criterio } | null {
  if (faixa !== '8d_2m' && faixa !== '2m_5a') return null
  const t = TABELA1_AAP[faixa]
  const provavel = atinge(u, t.provavel)
  const inflamacao = atinge(u, t.inflamacao)
  return provavel && inflamacao ? { provavel, inflamacao } : null
}

const PARCIAL = 'o exame feito não atinge o limiar e o outro não foi feito'

/** Leitura da urinálise com a urocultura ainda pendente (Tabela 1, CPG p. 5; Figura 2, p. 28). */
export function lerUrinaliseAap(faixa: FaixaItu, u: Urinalise): string | null {
  const p = piuriaAap(faixa, u)
  if (!p) return null
  if (faixa === '8d_2m') {
    const t = TABELA1_AAP['8d_2m'].provavel.texto
    if (p.provavel === 'sim') return `ITU provável com a urocultura pendente (${t}; Tabela 1, CPG p. 5). Urocultura por sonda ou punção suprapúbica.`
    return `Abaixo do limiar de ITU provável (${t})${p.provavel === 'parcial' ? `: ${PARCIAL}` : ''} (Tabela 1, CPG p. 5).`
  }
  const t = TABELA1_AAP['2m_5a']
  if (p.provavel === 'sim') return `ITU provável com a urocultura pendente (${t.provavel.texto}; Tabela 1, CPG p. 5). Na Figura 2 (2 a 24 meses), antibiótico presuntivo (p. 28).`
  if (p.inflamacao === 'sim') return `Inflamação presente (${t.inflamacao.texto}), abaixo do limiar de ITU provável com a urocultura pendente (${t.provavel.texto}) (Tabela 1, CPG p. 5). Na Figura 2 (2 a 24 meses), colher urocultura por sonda (p. 28).`
  return `Abaixo dos limiares da Tabela 1 (${t.inflamacao.texto})${p.inflamacao === 'parcial' ? `: ${PARCIAL}` : ''} (CPG p. 5).`
}

// ---------------------------------------------------------------------------
// Urocultura.

export type Coleta = 'sondagem' | 'psp' | 'jato' | 'saco'

const NOME_COLETA: Record<Coleta, string> = { sondagem: 'sondagem', psp: 'punção suprapúbica', jato: 'jato médio', saco: 'saco coletor' }

export type LeituraUrocultura = { referencia: string; linhas: string[] }

/** Urocultura pelo livro (p. 594–595): até 7 dias e acima de 5 anos. */
function lerUroculturaLivro(coleta: Coleta, ufcMl: number, umGerme: boolean): string {
  if (coleta === 'saco') return 'Saco coletor não é aceito para urocultura (contaminação elevada); serve só para análise urinária (p. 594).'
  if (!umGerme) return 'Mais de um germe na amostra: o livro considera indicativo de contaminação (p. 594).'
  if (ufcMl < 10_000) return '< 10.000 UFC/mL: o livro considera indicativo de contaminação (p. 594) — exceto na PSP, em que outras diretrizes aceitam qualquer contagem.'
  if (coleta === 'jato') return ufcMl >= 100_000 ? '≥ 100.000 UFC/mL em jato médio: o livro considera ITU, correlacionando com piúria para excluir bacteriúria assintomática (p. 595).' : 'Jato médio abaixo de 100.000 UFC/mL: abaixo do limiar do livro (p. 595).'
  return ufcMl >= 50_000
    ? '≥ 50.000 UFC/mL de um uropatógeno (sondagem ou PSP): critério da AAP de 2011 citado pelo livro, junto com piúria ou bacteriúria (p. 594).'
    : `Entre 10.000 e 50.000 UFC/mL por ${coleta === 'psp' ? 'PSP' : 'sondagem'}: abaixo do critério da AAP de 2011 citado pelo livro; o livro lembra que contagens menores podem ser ITU real (urina diluída, antibiótico prévio, acidez, uropatia obstrutiva) e que, na PSP, outras diretrizes aceitam qualquer número (p. 594).`
}

/** Urocultura pela AAP 2026 (Tabela 1, CPG p. 5; CPG p. 13; RT-diag p. 2, 6 e 7): 8 dias a 5 anos. */
function lerUroculturaAap(faixa: '8d_2m' | '2m_5a', coleta: Coleta, ufcMl: number, umGerme: boolean, u: Urinalise): string[] {
  if (coleta === 'saco')
    return ['Saco coletor não serve para urocultura nem para diagnosticar ITU (RT-diag p. 2; livro p. 594). Se a urinálise do saco passa dos limiares, isso basta para colher por sonda (nota "b" da Tabela 1, RT-diag p. 2).']
  if (!umGerme) return ['Mais de um germe na amostra: em geral, contaminação (CPG p. 13; RT-diag p. 7).']
  if (faixa === '8d_2m' && coleta === 'jato')
    return ['Abaixo de 2 meses a AAP só aceita sonda ou punção suprapúbica para a urocultura (Tabela 1, CPG p. 5): jato médio não serve nesta idade.']
  const limiar = coleta === 'jato' ? 100_000 : 10_000
  const limiarTxt = coleta === 'jato' ? '100.000' : '10.000'
  const linhas: string[] = []
  if (ufcMl < limiar) {
    linhas.push(`Abaixo de ${limiarTxt} UFC/mL por ${NOME_COLETA[coleta]}: urocultura não positiva pela AAP 2026 (Tabela 1, CPG p. 5). Com urocultura negativa, a AAP orienta não tratar ou suspender o antibiótico empírico (RT-diag p. 6).`)
    if (coleta === 'sondagem' || coleta === 'psp') linhas.push('O corte de 50.000 UFC/mL da AAP de 2011 caiu para 10.000 (CPG p. 13; RT-diag p. 7).')
    return linhas
  }
  linhas.push(`≥ ${limiarTxt} UFC/mL de um uropatógeno por ${NOME_COLETA[coleta]}: urocultura positiva pela AAP 2026 (Tabela 1, CPG p. 5; RT-diag p. 7).`)
  if (coleta === 'psp' && faixa === '2m_5a')
    linhas.push('Na Tabela 1 a punção suprapúbica só aparece na linha de 0 a < 2 meses; o texto (CPG p. 13; RT-diag p. 7) fala em sonda ou punção sem separar idade.')
  const t = TABELA1_AAP[faixa].inflamacao.texto
  const p = piuriaAap(faixa, u)
  if (!p) linhas.push(`Falta a urinálise: a AAP exige inflamação junto com a urocultura (${t}, em qualquer coleta; Tabela 1, CPG p. 5).`)
  else if (p.inflamacao === 'sim') linhas.push(`Com inflamação na urinálise (${t}, em qualquer coleta): preenche a definição de ITU da AAP, com os sintomas (Tabela 1, CPG p. 5; RT-diag p. 1).`)
  else
    linhas.push(`Sem inflamação pelo limiar da Tabela 1 (${t})${p.inflamacao === 'parcial' ? `: ${PARCIAL}` : ''}. A AAP exige piúria para o diagnóstico; urocultura positiva sem inflamação não preenche a definição (Tabela 1, CPG p. 5).`)
  return linhas
}

/**
 * Leitura da urocultura pela faixa de idade (decisão do RT, 11/11/2026): de 8
 * dias a 5 anos, AAP 2026, com a urinálise; até 7 dias e acima de 5 anos, o
 * livro (p. 594–595). Diz qual referência foi aplicada.
 */
export function lerUrocultura(faixa: FaixaItu, coleta: Coleta, ufcMl: number, umGerme: boolean, urinalise: Urinalise = SEM_URINALISE): LeituraUrocultura | null {
  if (!Number.isFinite(ufcMl) || ufcMl < 0) return null
  if (faixa === '8d_2m' || faixa === '2m_5a') return { referencia: REFERENCIA_AAP, linhas: lerUroculturaAap(faixa, coleta, ufcMl, umGerme, urinalise) }
  return { referencia: REFERENCIA_LIVRO, linhas: [lerUroculturaLivro(coleta, ufcMl, umGerme)] }
}

/** Leucocitúria do livro (p. 593): ≥ 5/campo (centrifugada) ou ≥ 10/mm³ = 10.000/mL (não centrifugada). Até 7 dias e acima de 5 anos. */
export const LEUCOCITURIA = { centrifugadaCampo: 5, naoCentrifugadaMm3: 10 }

const AP_CEFALEXINA = 'máx. do Apêndice: 4 g/dia (p. 899)'

export const DOSES_ITU_ORAL: DoseLivro[] = [
  { id: 'amoxicilina', nome: 'Amoxicilina', unidade: 'mg', porKgDia: [50, 100], doses: [2, 3], via: 'VO', pagina: 'p. 597 (Tabela 3)', nota: 'Não usar na pielonefrite: não atinge concentração adequada no parênquima (p. 598).' },
  { id: 'amoxclav', nome: 'Amoxicilina-clavulanato', unidade: 'mg', porKgDia: [40, 50], doses: [3, 3], via: 'VO', pagina: 'p. 597 (Tabela 3)',
    nota: 'Apêndice (p. 898): apresentação 4:1, 20 a 40 mg/kg/dia em 3 doses, máx. 1.500 mg/dia; 7:1, 25 a 45 mg/kg/dia em 2 doses, máx. 1.750 mg/dia — o máximo depende da apresentação e não é aplicado.' },
  { id: 'cefalexina', nome: 'Cefalexina', unidade: 'mg', porKgDia: [50, 100], doses: [2, 4], maxDia: 4000, fonteMaximo: AP_CEFALEXINA, via: 'VO', pagina: 'p. 597 (Tabela 3)' },
  { id: 'cefadroxila', nome: 'Cefadroxila', unidade: 'mg', porKgDia: [30, 30], doses: [2, 3], maxDia: 2000, fonteMaximo: 'máx. do Apêndice: 2 g/dia (p. 899)', via: 'VO', pagina: 'p. 597 (Tabela 3)' },
  { id: 'cefuroxima', nome: 'Cefuroxima', unidade: 'mg', porKgDia: [30, 30], doses: [2, 2], maxDose: 500, fonteMaximo: 'máx. do Apêndice: VO 500 mg/dose (p. 900)', via: 'VO', pagina: 'p. 597 (Tabela 3)' },
  { id: 'smx-tmp', nome: 'Sulfametoxazol + trimetoprima (dose em TMP)', unidade: 'mg', porKgDia: [6, 12], doses: [2, 2], via: 'VO; equivale a 30 a 60 mg/kg/dia de SMZ', pagina: 'p. 597 (Tabela 3)' },
  { id: 'cipro-vo', nome: 'Ciprofloxacina VO', unidade: 'mg', porKgDia: [20, 40], doses: [2, 2], maxDia: 1500, fonteMaximo: 'máx. do Apêndice: VO 1.500 mg/dia (p. 900)', via: 'VO', pagina: 'p. 597 (Tabela 3)',
    nota: 'Apêndice (p. 900): 20 a 30 mg/kg/dia.' },
  { id: 'nitrofurantoina', nome: 'Nitrofurantoína', unidade: 'mg', porKgDia: [5, 7], doses: [4, 4], maxDia: 400, fonteMaximo: 'máx. do Apêndice: 400 mg/dia (p. 905)', via: 'VO', pagina: 'p. 597 (Tabela 3)',
    nota: 'Não usar na pielonefrite (p. 598). Apêndice (p. 905): não usar em < 1 mês, deficiência de G6PD ou doença renal grave.' },
]

export const DOSES_ITU_PARENTERAL: DoseLivro[] = [
  { id: 'ampicilina', nome: 'Ampicilina', unidade: 'mg', porKgDia: [50, 100], doses: [4, 4], via: 'IV', pagina: 'p. 597 (Tabela 4)', nota: 'Apêndice (p. 898): IM ou IV 100 a 400 mg/kg/dia.' },
  { id: 'amicacina', nome: 'Amicacina', unidade: 'mg', porKgDia: [15, 15], doses: [1, 3], via: 'IV ou IM (dose única diária possível, p. 598)', pagina: 'p. 597 (Tabela 4)' },
  { id: 'gentamicina', nome: 'Gentamicina', unidade: 'mg', porKgDia: [7.5, 7.5], doses: [1, 3], via: 'IV ou IM (dose única diária possível, p. 598)', pagina: 'p. 597 (Tabela 4)', nota: 'Apêndice (p. 902): 5 a 10 mg/kg/dia, 1 vez ao dia.' },
  { id: 'tobramicina', nome: 'Tobramicina', unidade: 'mg', porKgDia: [5, 5], doses: [3, 3], via: 'IV', pagina: 'p. 597 (Tabela 4)' },
  { id: 'cefazolina', nome: 'Cefazolina', unidade: 'mg', porKgDia: [25, 50], doses: [3, 3], via: 'IV', pagina: 'p. 597 (Tabela 4)' },
  { id: 'cefotaxima', nome: 'Cefotaxima', unidade: 'mg', porKgDia: [50, 150], doses: [3, 4], maxDia: 6000, fonteMaximo: 'máx. do Apêndice: 6 g/dia (p. 899)', via: 'IV', pagina: 'p. 597 (Tabela 4)' },
  { id: 'ceftriaxona', nome: 'Ceftriaxona', unidade: 'mg', porKgDia: [70, 70], doses: [1, 2], maxDose: 2000, fonteMaximo: 'máx. do Apêndice: 2 g/dose (p. 899)', via: 'IV ou IM', pagina: 'p. 598 (Tabela 4)' },
  { id: 'cefepima', nome: 'Cefepima', unidade: 'mg', porKgDia: [100, 100], doses: [2, 2], maxDose: 2000, fonteMaximo: 'máx. do Apêndice: 2 g/dose (p. 899)', via: 'IV', pagina: 'p. 598 (Tabela 4)' },
  { id: 'ceftazidima', nome: 'Ceftazidima', unidade: 'mg', porKgDia: [90, 150], doses: [2, 3], maxDia: 6000, fonteMaximo: 'máx. do Apêndice: 6 g/dia (p. 899)', via: 'IV', pagina: 'p. 598 (Tabela 4)' },
  { id: 'ticarcilina', nome: 'Ticarcilina', unidade: 'mg', porKgDia: [300, 300], doses: [4, 4], via: 'IV', pagina: 'p. 598 (Tabela 4)' },
  { id: 'cipro-iv', nome: 'Ciprofloxacina IV', unidade: 'mg', porKgDia: [20, 30], doses: [2, 2], maxDia: 800, fonteMaximo: 'máx. do Apêndice: IV 800 mg/dia (p. 900)', via: 'IV', pagina: 'p. 598 (Tabela 4)' },
]

/** Quadro 3 (p. 596–597): tratamento parenteral e internação na pielonefrite — referência. */
export const QUADRO3: string[] = [
  'Idade inferior a 2 meses (considerar menos de 3 meses)',
  'Adesão questionável ou dificuldade de acompanhamento',
  'Inabilidade de manter hidratação ou tomar medicamento VO',
  'Desidratação',
  'Suspeita de sepse ou doença grave com comprometimento do estado geral',
  'Dúvida quanto ao diagnóstico de ITU',
  'Doenças obstrutivas e malformações complexas do trato urinário',
  'Insuficiência renal aguda associada',
  'Imunodeprimidos',
]

/** AAP 2026, KAS 3A e 3B (CPG p. 2, 3 e 15), ao lado do Quadro 3 — nota, decisão do RT (I8 = B). */
export const NOTA_VIA_AAP =
  'AAP 2026: a partir de 29 dias (mais de 28 dias e menos de 5 anos), via oral em vez de parenteral ou sequencial com internação, quando a criança tolera e não precisa de internação por outro motivo (KAS 3B, forte, certeza muito baixa; CPG p. 2 e 15); se houver dúvida de a família conseguir o remédio oral logo, pode-se dar uma dose parenteral antes (CPG p. 3). De 8 a 28 dias, parenteral com troca precoce para oral (KAS 3A, condicional, certeza muito baixa; CPG p. 2 e 15). Os critérios do livro abaixo continuam.'

/** AAP 2026, escolha empírica (CPG p. 16), sem dose — nota, decisão do RT (I9 = B). */
export const NOTA_ESCOLHA_AAP =
  'AAP 2026 (CPG p. 16), sem dose: preferir espectro estreito; sem doença grave, cefazolina ou cefalexina se a sensibilidade local passar de 80% a 85%. As doses abaixo são as do livro.'

/** AAP 2026, KAS 2 (CPG p. 2 e 14), ao lado da duração do livro — nota, decisão do RT (I7 = B). */
export const NOTA_DURACAO_AAP =
  'AAP 2026 (KAS 2, condicional, certeza baixa; CPG p. 2 e 14): curso de 7 dias ou menos. 2 anos ou mais, sem anomalia, cistite sem febre: 3 a 5 dias. 2 a 24 meses: 5 a 7 dias. 2 anos ou mais com quadro de pielonefrite (p. ex., febre ≥ 39 °C): 5 a 7 dias. Mais de 7 dias pode ser dado de 8 dias a 2 meses, com anomalia urinária, com bacteremia ou sem resposta ao curso inicial.'

export const REFERENCIAS_ITU: { texto: string; pagina: string; notaAap?: string }[] = [
  { texto: 'Nitrito e esterase negativos: ITU improvável; ambos positivos: grande possibilidade (nitrito mais específico, 98%). Análise negativa em tudo permite observar sem antibiótico, mas a urocultura é sempre necessária.', pagina: 'p. 593–594' },
  { texto: 'Pielonefrite: 7 a 14 dias, habitualmente 10; oral comparável ao parenteral nos sem comorbidade e > 2–3 meses. Cistite esporádica: 5 a 7 dias VO; de repetição: 10 dias.', pagina: 'p. 597–598', notaAap: NOTA_DURACAO_AAP },
  { texto: 'Urocultura de controle só se a febre persistir > 48–72 h; e 2 a 3 dias após o fim do tratamento. AINE devem ser evitados; corticoide não está indicado.', pagina: 'p. 597–598' },
  { texto: 'Laboratório na pielonefrite: PCR > 20 mg/L, VHS > 25 mm/h, procalcitonina ≥ 1 ng/mL (inespecíficos).', pagina: 'p. 595' },
]

export const ERRATA_ITU =
  'Na cistite de repetição o texto remete às cefalosporinas e à amoxicilina-clavulanato da "Tabela 2" (p. 598); os antibióticos estão na Tabela 3 (orais).'
