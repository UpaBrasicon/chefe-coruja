import { fichaP4, type DoseLivro } from './fonteP4.ts'

// Infecção urinária — livro do ICr, cap. 57 (p. 588–601). Contagem de fatores
// da Tabela 2 (AAP), limiares de urocultura e de leucocitúria por método de
// coleta, antibióticos orais (Tabela 3) e parenterais (Tabela 4) por peso.
// Máximos que o capítulo não traz vêm do Apêndice (p. 897–910). O capítulo não
// dá dose para o recém-nascido ("associa-se ampicilina", sem dose): RN bloqueado.

export const fichaItuPed = fichaP4('ped-infeccao-urinaria', 'Infecção urinária — criança', 'cap. 57, p. 588–601; Apêndice, p. 898–909')

export type Sexo = 'menina' | 'menino'

/** Fatores de risco da Tabela 2 (p. 592). */
export const FATORES_MENINA = ['Etnia branca', 'Idade abaixo de 12 meses', 'Temperatura ≥ 39 °C', 'Febre ≥ 2 dias', 'Febre sem sinais localizatórios']
export const FATORES_MENINO = ['Etnia não branca', 'Temperatura ≥ 39 °C', 'Febre ≥ 24 horas', 'Febre sem sinais localizatórios']

/**
 * Tabela 2 (p. 592), lida como impressa: testar a urina se, para probabilidade
 * > 1%: meninas "> um fator"; meninos não circuncidados "≥ 0 fatores" (sempre);
 * circuncidados "> 2 fatores". Para probabilidade > 2%: meninas "> 2";
 * circuncidados "> 3". Vale para 2 meses a 2 anos com febre sem sinais
 * localizatórios, sem doença urinária conhecida (p. 592).
 */
export function testarUrinaAap(sexo: Sexo, circuncidado: boolean, fatores: number): { limiar1: boolean; limiar2: boolean } | null {
  if (!Number.isInteger(fatores) || fatores < 0) return null
  if (sexo === 'menina') return { limiar1: fatores > 1, limiar2: fatores > 2 }
  if (!circuncidado) return { limiar1: true, limiar2: true }
  return { limiar1: fatores > 2, limiar2: fatores > 3 }
}

export const NOTA_TABELA2 =
  'A Tabela 2 escreve "> um fator" para meninas no limiar de 1% e "≥ 0 fatores" para meninos não circuncidados (isto é, sempre testar). A ferramenta aplica exatamente o texto impresso; a decisão de coletar é do médico (p. 592).'

export type Coleta = 'sondagem' | 'psp' | 'jato' | 'saco'

/** Urocultura (p. 594–595): leitura pelo método de coleta. */
export function lerUrocultura(coleta: Coleta, ufcMl: number, umGerme: boolean): string | null {
  if (!Number.isFinite(ufcMl) || ufcMl < 0) return null
  if (coleta === 'saco') return 'Saco coletor não é aceito para urocultura (contaminação elevada); serve só para análise urinária (p. 594).'
  if (!umGerme) return 'Mais de um germe na amostra: o livro considera indicativo de contaminação (p. 594).'
  if (ufcMl < 10_000) return '< 10.000 UFC/mL: o livro considera indicativo de contaminação (p. 594) — exceto na PSP, em que outras diretrizes aceitam qualquer contagem.'
  if (coleta === 'jato') return ufcMl >= 100_000 ? '≥ 100.000 UFC/mL em jato médio: o livro considera ITU, correlacionando com piúria para excluir bacteriúria assintomática (p. 595).' : 'Jato médio abaixo de 100.000 UFC/mL: abaixo do limiar do livro (p. 595).'
  return ufcMl >= 50_000
    ? '≥ 50.000 UFC/mL de um uropatógeno (sondagem ou PSP): critério da AAP, junto com piúria ou bacteriúria (p. 594).'
    : `Entre 10.000 e 50.000 UFC/mL por ${coleta === 'psp' ? 'PSP' : 'sondagem'}: abaixo do critério da AAP; o livro lembra que contagens menores podem ser ITU real (urina diluída, antibiótico prévio, acidez, uropatia obstrutiva) e que, na PSP, outras diretrizes aceitam qualquer número (p. 594).`
}

/** Leucocitúria (p. 593): ≥ 5/campo (centrifugada) ou ≥ 10/mm³ = 10.000/mL (não centrifugada). */
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

export const REFERENCIAS_ITU: { texto: string; pagina: string }[] = [
  { texto: 'Nitrito e esterase negativos: ITU improvável; ambos positivos: grande possibilidade (nitrito mais específico, 98%). Análise negativa em tudo permite observar sem antibiótico, mas a urocultura é sempre necessária.', pagina: 'p. 593–594' },
  { texto: 'Pielonefrite: 7 a 14 dias, habitualmente 10; oral comparável ao parenteral nos sem comorbidade e > 2–3 meses. Cistite esporádica: 5 a 7 dias VO; de repetição: 10 dias.', pagina: 'p. 597–598' },
  { texto: 'Urocultura de controle só se a febre persistir > 48–72 h; e 2 a 3 dias após o fim do tratamento. AINE devem ser evitados; corticoide não está indicado.', pagina: 'p. 597–598' },
  { texto: 'Laboratório na pielonefrite: PCR > 20 mg/L, VHS > 25 mm/h, procalcitonina ≥ 1 ng/mL (inespecíficos).', pagina: 'p. 595' },
]

export const ERRATA_ITU =
  'Na cistite de repetição o texto remete às cefalosporinas e à amoxicilina-clavulanato da "Tabela 2" (p. 598); os antibióticos estão na Tabela 3 (orais).'
