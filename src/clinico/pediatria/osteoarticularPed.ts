import { fichaP4, type DoseLivro } from './fonteP4.ts'
import { positivoP5, type ItemLivro } from './fonteP5.ts'

// Artrite séptica e osteomielite — livro do ICr, cap. 49 (p. 494–501).
// Antibioticoterapia pela frequência local de MRSA (Tabela 3, p. 498–499): o
// livro dá doses MÍNIMAS ("≥"); a ferramenta calcula o mínimo e mostra o
// máximo do Apêndice quando ele existe. Cobertura por faixa etária (Tabela 2),
// classificação temporal, líquido sinovial e duração (Figura 2). Neonato:
// "tratamento individualizado" (Figura 2) — sem cálculo.

export const fichaOsteoarticularPed = fichaP4('ped-artrite-osteomielite', 'Artrite séptica e osteomielite — criança', 'cap. 49, p. 494–501; Apêndice, p. 900–909')

export type Cenario = 'mssa90' | 'mrsa-clinda-10' | 'mrsa-clinda-10-25' | 'mrsa-clinda-25' | 'resist-vanco-tmp'

/** Tabela 3: cenários de resistência local. */
export const CENARIOS: [Cenario, string][] = [
  ['mssa90', '> 90% MSSA na comunidade'],
  ['mrsa-clinda-10', '> 10% MRSA + resistência à clindamicina < 10%'],
  ['mrsa-clinda-10-25', '> 10% MRSA + resistência à clindamicina 10–25%'],
  ['mrsa-clinda-25', '> 10% MRSA + resistência à clindamicina > 25%'],
  ['resist-vanco-tmp', 'Resistência a vancomicina/TMP-SMX'],
]

const MIN = 'O livro dá dose mínima ("≥"); a conta mostra o mínimo.'
const AP = (pag: string, max: string) => `máx. do Apêndice: ${max} (${pag})`

const CEFALO: DoseLivro = { id: 'cefalo1', nome: 'Cefalosporina de 1ª geração', unidade: 'mg', porKgDia: [150, 150], doses: [4, 4], via: '4x/dia', pagina: 'p. 498', nota: `${MIN} O Apêndice não traz cefazolina; sem máximo aplicado.` }
const OXA: DoseLivro = { id: 'oxacilina', nome: 'Oxacilina', unidade: 'mg', porKgDia: [200, 200], doses: [4, 4], via: 'IV 4x/dia', pagina: 'p. 498',
  errata: 'Apêndice (p. 906, conferido no PDF): oxacilina "máx. 2 g/dia" — incompatível com os 200 mg/kg/dia do capítulo acima de 10 kg; o teto não é aplicado.' }
const CLINDA: DoseLivro = { id: 'clindamicina', nome: 'Clindamicina', unidade: 'mg', porKgDia: [40, 40], doses: [4, 4], maxDia: 4800, fonteMaximo: AP('p. 900', '4,8 g/dia IV'), via: '4x/dia', pagina: 'p. 498', nota: MIN }
const VANCO: DoseLivro = { id: 'vancomicina', nome: 'Vancomicina', unidade: 'mg', porKgDia: [40, 40], doses: [4, 4], maxDia: 2000, fonteMaximo: AP('p. 909', '2.000 mg/dia'), via: 'IV 4x/dia; monitorar nível sérico', pagina: 'p. 498–499', nota: MIN }
const TMP: DoseLivro = { id: 'tmpsmx', nome: 'TMP-SMX', unidade: 'mg', porKgDia: [16, 16], doses: [2, 2], via: '2x/dia; dose do trimetoprim (Apêndice, p. 908)', pagina: 'p. 499', nota: `${MIN} O capítulo não diz o componente; o Apêndice expressa a dose pelo trimetoprim.` }
const LINE: DoseLivro = { id: 'linezolida', nome: 'Linezolida', unidade: 'mg', porKgDia: [30, 30], doses: [3, 3], maxDose: 600, fonteMaximo: AP('p. 904', '600 mg/dose'), via: '3x/dia', pagina: 'p. 499', nota: MIN }

/** Tabela 3 por cenário (p. 498–499). */
export const TABELA3: Record<Cenario, DoseLivro[]> = {
  mssa90: [CEFALO, OXA, CLINDA],
  'mrsa-clinda-10': [CLINDA],
  'mrsa-clinda-10-25': [VANCO, CLINDA],
  'mrsa-clinda-25': [VANCO, TMP],
  'resist-vanco-tmp': [LINE],
}

export type FaixaOsteo = '0-3m' | '3m-5a' | '>5a'

/** Tabela 2 (p. 497–498): faixa etária. Com 3 meses e 5 anos exatos a tabela não define ("0–3 meses", "3 meses a 5 anos", "> 5 anos"): 3 meses entra em "3 meses a 5 anos" e 5 anos exatos também. */
export function faixaOsteo(idadeMeses: number): FaixaOsteo | null {
  if (!Number.isFinite(idadeMeses) || idadeMeses < 0) return null
  if (idadeMeses < 3) return '0-3m'
  if (idadeMeses <= 60) return '3m-5a'
  return '>5a'
}

export const TABELA2_OSTEO: Record<FaixaOsteo, { agentes: string; cobertura: string }> = {
  '0-3m': { agentes: 'Estreptococo do grupo A, MSSA, E. coli e outros Gram-negativos, Candida', cobertura: 'Cobertura MSSA x MRSA + cefalosporina de 3ª geração' },
  '3m-5a': { agentes: 'MSSA, K. kingae, S. pneumoniae, H. influenzae tipo b e não tipável, E. coli', cobertura: 'Cobertura MSSA x MRSA (+ K. kingae < 5 anos: cefalosporina de 2ª/3ª geração, ampicilina ou ampicilina-sulbactam; resistente a clindamicina e vancomicina)' },
  '>5a': { agentes: 'S. aureus meticilino sensível', cobertura: 'Cobertura MSSA x MRSA' },
}

/** Osteomielite (p. 494): aguda ≤ 2 semanas; subaguda 2 semanas a 3 meses; crônica depois. */
export function classificarOsteomielite(diasSintomas: number): 'aguda' | 'subaguda' | 'crônica' | null {
  if (!Number.isFinite(diasSintomas) || diasSintomas < 0) return null
  if (diasSintomas <= 14) return 'aguda'
  if (diasSintomas <= 90) return 'subaguda'
  return 'crônica'
}

/** Líquido sinovial (p. 496): Gram positivo, > 50.000 leucócitos/mm³ e predomínio de PMN sugerem artrite séptica. */
export function sinovialSugestivo(leucocitos: number, predominioPmn: boolean, gramPositivo: boolean): { achados: string[] } | null {
  if (!positivoP5(leucocitos) && !gramPositivo && !predominioPmn) return null
  const achados: string[] = []
  if (positivoP5(leucocitos) && leucocitos > 50_000) achados.push('leucócitos > 50.000/mm³')
  if (predominioPmn) achados.push('predomínio de polimorfonucleares')
  if (gramPositivo) achados.push('Gram positivo')
  return { achados }
}

export const DURACAO: ItemLivro[] = [
  { texto: 'Artrite séptica sem complicação: 10 dias a 4 semanas incluindo a fase VO; tempo total 10 a 14 dias na Figura 2.', pagina: 'p. 498; Figura 2, p. 500' },
  { texto: 'Osteomielite não complicada: 3 a 4 semanas no total (IV + VO) pela sociedade citada; a Figura 2 fala em 3 semanas. EV por 2 a 4 dias seguido de VO foi seguro com MSSA.', pagina: 'p. 498; Figura 2, p. 500' },
  { texto: 'MRSA com melhora: EV por 3 a 4 semanas (artrite) ou 4 a 6 semanas (osteomielite) na Figura 2.', pagina: 'Figura 2, p. 500' },
  { texto: 'Cirurgia se evolução desfavorável após 48 a 72 h ou coleção significativa; na artrite séptica, drenagem e irrigação sempre.', pagina: 'p. 499' },
  { texto: 'Suspeita de salmonela (falciforme): cefalosporina de 3ª geração (ceftriaxona ou cefotaxima); cloranfenicol se indisponíveis e antibiograma favorável.', pagina: 'p. 498' },
  { texto: 'Trombose venosa profunda e TEP séptico podem ocorrer em até 30% das osteomielites agudas; hemocultura identifica o agente em 40%.', pagina: 'p. 496' },
]
