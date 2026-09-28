import { fichaP4, type DoseLivro } from './fonteP4.ts'
import { positivoP5, type ItemLivro } from './fonteP5.ts'

// Febre sem sinais localizatórios — livro do ICr, cap. 45 (p. 461–470).
// Faixas etárias dos fluxogramas (0–21 dias, 22–90 dias, 3–24 meses), leitura
// do leucograma e da PCR, critérios de coleta de urina e antibióticos orais por
// peso. O capítulo dá a amoxicilina (50 a 90 mg/kg/dia) e só NOMEIA os demais;
// as doses deles saem da Tabela 2 do Apêndice (p. 898–900), citadas como tal.
// Ceftriaxona/cefotaxima no neonato: o capítulo não dá dose e o Apêndice não
// contempla o período neonatal — a ferramenta não calcula para o RN.

export const fichaFebreSemSinais = fichaP4('ped-febre-sem-sinais', 'Febre sem sinais localizatórios — criança', 'cap. 45, p. 461–470; Apêndice, p. 898–900')

export type FaixaFssl = '0-21d' | '22-60d' | '61-90d' | '3-24m' | 'fora'

/**
 * Faixa dos fluxogramas (Figuras 1–3, p. 465–468). Idade em dias até 90; depois,
 * em meses completos (3 a 24). Acima de 24 meses os fluxogramas não se aplicam.
 */
export function faixaFssl(idadeDias: number, idadeMeses: number): FaixaFssl | null {
  if (positivoP5(idadeDias)) {
    if (idadeDias <= 21) return '0-21d'
    if (idadeDias <= 60) return '22-60d'
    if (idadeDias <= 90) return '61-90d'
  }
  if (Number.isFinite(idadeMeses) && idadeMeses >= 3) return idadeMeses <= 24 ? '3-24m' : 'fora'
  return positivoP5(idadeDias) ? 'fora' : null
}

export const TEXTO_FAIXA: Record<FaixaFssl, string> = {
  '0-21d': 'Figura 1 (p. 465): febre ≥ 38,0 °C → protocolo de sepse, admissão, hemograma, hemocultura, urina, liquor e cefalosporina de 3ª geração EV (cefotaxima ou ceftriaxona); aciclovir se meningite herpética.',
  '22-60d': 'Figura 2 (p. 467): febre ≥ 38,0 °C. Com hemograma alterado → seguir o fluxo do RN (sepse). Sedimento alterado → pielonefrite com admissão e ceftriaxona EV (< 60 dias).',
  '61-90d': 'Figura 2 (p. 467): febre ≥ 38,0 °C. Sedimento alterado sem malformação/ITU de repetição → pode ser ambulatorial com cefuroxima ou amoxicilina-clavulanato VO, conforme a confiabilidade dos responsáveis.',
  '3-24m': 'Figura 3 (p. 468): temperatura ≥ 39,0 °C. Vacina pneumocócica completa = 2 doses no 1º ano (p. 462). Hemograma alterado e urina normal → amoxicilina VO; urina alterada → cefuroxima ou amoxicilina-clavulanato VO.',
  fora: 'Os fluxogramas do capítulo vão até 24 meses (algumas referências usam a expressão FSSL até 36 meses, p. 461).',
}

/**
 * Leucograma de maior risco para DBG (p. 467 e dica, p. 468): leucócitos ≥ 15.000 ou < 5.000,
 * bastões/neutrófilos > 0,2 ou neutrófilos > 10.000/mm³. Menores de 90 dias: neutrófilos > 4.000 (p. 463).
 */
export function leucogramaAlterado(v: { leucocitos: number; neutrofilos: number; bastoesSobreNeutrofilos: number }, menorQue90Dias: boolean): { alterado: boolean; motivos: string[] } | null {
  const { leucocitos, neutrofilos, bastoesSobreNeutrofilos } = v
  if (![leucocitos, neutrofilos, bastoesSobreNeutrofilos].some((x) => positivoP5(x))) return null
  const motivos: string[] = []
  if (positivoP5(leucocitos) && leucocitos >= 15_000) motivos.push('leucócitos ≥ 15.000')
  if (positivoP5(leucocitos) && leucocitos < 5_000) motivos.push('leucócitos < 5.000')
  if (positivoP5(neutrofilos) && neutrofilos > 10_000) motivos.push('neutrófilos > 10.000')
  if (menorQue90Dias && positivoP5(neutrofilos) && neutrofilos > 4_000) motivos.push('neutrófilos > 4.000 (< 90 dias)')
  if (positivoP5(bastoesSobreNeutrofilos) && bastoesSobreNeutrofilos > 0.2) motivos.push('bastões/neutrófilos > 0,2')
  return { alterado: motivos.length > 0, motivos }
}

export const NOTA_LEUCOGRAMA =
  'O texto da p. 463 escreve "maiores que 15.000"; a indicação de hemocultura (p. 467) e a Figura 3 usam "≥ 15.000". A ferramenta usa ≥ 15.000.'

/** PCR > 20 mg/L: marcador mais acurado que o leucograma em < 2 meses (p. 464); corte da Figura 2. */
export const pcrAlterada = (pcrMgL: number) => (positivoP5(pcrMgL) ? pcrMgL > 20 : null)

/** Meninas (p. 462): coletar urina com 2 ou mais fatores. */
export const FATORES_MENINA: { id: string; texto: string }[] = [
  { id: 'menor12m', texto: 'Menor de 12 meses' },
  { id: 't39', texto: 'Temperatura > 39 °C' },
  { id: 'branca', texto: 'Etnia branca' },
  { id: 'semFoco', texto: 'Ausência de outro foco de febre' },
  { id: 'febre48', texto: 'Febre por mais de 48 horas' },
]

/** Meninos (p. 462): critérios para quem tem mais de 6 meses. */
export const CRITERIOS_MENINO: { id: string; texto: string }[] = [
  { id: 't39', texto: 'Temperatura > 39 °C' },
  { id: 'febre1d', texto: 'Febre por mais de 1 dia' },
  { id: 'semFoco', texto: 'Ausência de outro foco de febre' },
  { id: 'naoBranca', texto: 'Raça não branca' },
]

export type ColetaUrina = 'coletar' | 'nao-indicada' | 'indefinido'

/**
 * Coleta de urina (p. 462). Menina: ≥ 2 fatores. Menino < 6 meses: se T > 39 °C.
 * Menino > 6 meses: circuncidado com 3 dos 4 critérios; não circuncidado com 2 ou mais.
 * Aos 6 meses exatos o texto não define ("abaixo" x "mais que 6 meses").
 */
export function coletaUrina(sexo: 'menina' | 'menino', marcados: Set<string>, idadeMeses: number, circuncidado: boolean): ColetaUrina {
  if (sexo === 'menina') return FATORES_MENINA.filter((f) => marcados.has(f.id)).length >= 2 ? 'coletar' : 'nao-indicada'
  if (!Number.isFinite(idadeMeses)) return 'indefinido'
  if (idadeMeses < 6) return marcados.has('t39') ? 'coletar' : 'nao-indicada'
  if (idadeMeses === 6) return 'indefinido'
  const n = CRITERIOS_MENINO.filter((c) => marcados.has(c.id)).length
  return n >= (circuncidado ? 3 : 2) ? 'coletar' : 'nao-indicada'
}

/** Condições que excluem o protocolo (p. 463). */
export const EXCLUSOES: string[] = [
  'Doença de base com imunocomprometimento (falciforme, HIV, síndrome nefrótica, neoplasia, imunossupressor, outros)',
  'Contato com doença meningocócica',
  'Toxemia ou mau estado geral',
  'Infecção focal',
  'Imunização nas últimas 48 horas',
]

const AP = (p: string, max?: string) => (max ? `máx. do Apêndice: ${max} (${p})` : `Apêndice (${p})`)

/** Amoxicilina: dose do capítulo (p. 468); divisão e ausência de máximo pelo Apêndice (p. 898). */
export const DOSES_FSSL: DoseLivro[] = [
  { id: 'amoxicilina', nome: 'Amoxicilina — hemograma alterado, vacinação pneumocócica incompleta', unidade: 'mg', porKgDia: [50, 90], doses: [2, 3], via: 'VO; divisão em 2 a 3 vezes ao dia pelo Apêndice (p. 898)', pagina: 'p. 468',
    nota: 'O capítulo dá 50 a 90 mg/kg/dia sem máximo; o Apêndice (p. 898, 50 a 100 mg/kg/dia) também não traz máximo.' },
  { id: 'cefuroxima-vo', nome: 'Cefuroxima VO — ITU provável', unidade: 'mg', porKgDia: [20, 30], doses: [2, 2], maxDose: 500, fonteMaximo: AP('p. 900', '500 mg/dose'), via: 'VO de 12/12 h', pagina: 'Apêndice, p. 900',
    nota: 'O capítulo nomeia a cefuroxima (p. 466, 468) sem dose; dose do Apêndice.' },
  { id: 'amoxclav-7', nome: 'Amoxicilina-clavulanato 7:1 — ITU provável', unidade: 'mg', porKgDia: [25, 45], doses: [2, 2], maxDia: 1750, fonteMaximo: AP('p. 898', '1.750 mg/dia'), via: 'VO em 2 doses; dose da amoxicilina', pagina: 'Apêndice, p. 898',
    nota: 'O capítulo nomeia a associação (p. 466, 468) sem dose nem apresentação. Apresentação 4:1 no Apêndice: 20 a 40 mg/kg/dia em 3 doses, máx. 1.500 mg/dia.' },
  { id: 'ceftriaxona', nome: 'Ceftriaxona EV/IM — fora do período neonatal', unidade: 'mg', porKgDia: [50, 100], doses: [1, 2], maxDose: 2000, fonteMaximo: AP('p. 899', '2 g/dose'), via: 'IM ou IV, 1x/dia ou 12/12 h', pagina: 'Apêndice, p. 899',
    nota: 'O capítulo indica ceftriaxona (Figuras 1–2) sem dose. O Apêndice diz que "não deve ser usada em neonatos" e não contempla o período neonatal.' },
  { id: 'cefotaxima', nome: 'Cefotaxima EV — fora do período neonatal', unidade: 'mg', porKgDia: [150, 200], doses: [3, 4], maxDia: 6000, fonteMaximo: AP('p. 899', '6 g/dia'), via: 'IV ou IM a cada 6 a 8 h', pagina: 'Apêndice, p. 899',
    nota: 'O capítulo indica cefotaxima (Figura 1) sem dose. Para o RN o livro não traz dose de FSSL (a dose neonatal do livro é a da meningite, cap. 40).' },
]

export const REFERENCIAS_FSSL: ItemLivro[] = [
  { texto: 'FSSL: febre (retal ≥ 38 °C) há menos de 7 dias em criança em bom estado geral, sem causa na história e no exame.', pagina: 'p. 461' },
  { texto: 'Liquor: leucócitos > 8/mm³ (S 77%, E 79%) ou > 10/mm³ (S 73%, E 84%) para meningite bacteriana.', pagina: 'p. 463' },
  { texto: 'Urina: > 10 leucócitos/campo ou > 10.000 leucócitos/mm³ e bacterioscopia positiva sugerem ITU; urocultura sempre.', pagina: 'p. 463–464' },
  { texto: 'Radiografia de tórax não é rotina; pneumonia oculta mais provável com febre > 3 dias e leucocitose > 20.000/mm³.', pagina: 'p. 464' },
  { texto: 'Procalcitonina não entrou nos fluxogramas (custo e disponibilidade).', pagina: 'p. 464' },
  { texto: 'Aciclovir empírico no RN com teste rápido positivo para HSV, história materna, convulsão, pleocitose ou lesões sugestivas (doses: ferramenta de meningite, cap. 40).', pagina: 'p. 466' },
  { texto: 'Toda criança < 2 anos com fator de risco para ITU deve ser investigada; coleta por sondagem vesical de alívio ou punção suprapúbica.', pagina: 'p. 462' },
]
