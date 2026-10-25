import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP4, type DoseLivro } from './fonteP4.ts'
import { positivoP5, type ItemLivro } from './fonteP5.ts'

// Febre sem sinais localizatórios — livro do ICr, cap. 45 (p. 461–470).
// Faixas etárias dos fluxogramas (0–21 dias, 22–90 dias, 3–24 meses), leitura
// do leucograma e da PCR, critérios de coleta de urina e antibióticos orais por
// peso. O capítulo dá a amoxicilina (50 a 90 mg/kg/dia) e só NOMEIA os demais;
// as doses deles saem da Tabela 2 do Apêndice (p. 898–900), citadas como tal.
// Ceftriaxona/cefotaxima no neonato: o capítulo não dá dose e o Apêndice não
// contempla o período neonatal — a ferramenta não calcula para o RN.
//
// Versão .1 de 25/10/2026 (lacunas da Central, lote 3; decisão do RT de
// 23/10/2026): lactente de 8 a 60 dias com o livro e a AAP 2021/PECARN lado a
// lado. A AAP foi lida no site da revista e o PECARN no resumo do PubMed. As
// doses continuam só as do livro do ICr.

export const AAP_FEBRIL_2021: Fonte = {
  citacao: 'Pantell RH, Roberts KB, Adams WG, et al. Clinical Practice Guideline: Evaluation and Management of Well-Appearing Febrile Infants 8 to 60 Days Old. Pediatrics. 2021;148(2):e2021052228. Elegibilidade e exclusões; marcadores inflamatórios nas notas das Figuras 1 a 3; KAS 1 a 21. Texto lido no site da revista.',
  url: 'https://doi.org/10.1542/peds.2021-052228',
  pediatrica: true,
}

export const PECARN_FEBRIL_2019: Fonte = {
  citacao: 'Kuppermann N, Dayan PS, Levine DA, et al. A Clinical Prediction Rule to Identify Febrile Infants 60 Days and Younger at Low Risk for Serious Bacterial Infections. JAMA Pediatr. 2019;173(4):342–351. Regra e validação conferidas no resumo (PubMed 30776077).',
  url: 'https://doi.org/10.1001/jamapediatrics.2018.5501',
  pediatrica: true,
}

const baseFssl = fichaP4('ped-febre-sem-sinais', 'Febre sem sinais localizatórios — criança', 'cap. 45, p. 461–470; Apêndice, p. 898–900')

export const fichaFebreSemSinais: Ficha = {
  ...baseFssl,
  versao: '2026-10-25.1',
  fontes: [...baseFssl.fontes, AAP_FEBRIL_2021, PECARN_FEBRIL_2019],
  revisadoEm: '25/10/2026 (lacunas da Central, lote 3: AAP 2021 e PECARN 2019 ao lado do livro; doses só do ICr)',
}

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

// ── AAP 2021 e PECARN 2019 (lactente de 8 a 60 dias) ───────────────────────

export type FaixaAap = '8-21' | '22-28' | '29-60'

/** Faixas da AAP 2021 (Figuras 1 a 3). Fora de 8 a 60 dias a diretriz não se aplica. */
export function faixaAap2021(idadeDias: number): FaixaAap | null {
  if (!Number.isFinite(idadeDias) || idadeDias < 8 || idadeDias > 60) return null
  return idadeDias <= 21 ? '8-21' : idadeDias <= 28 ? '22-28' : '29-60'
}

export type MarcadoresInformados = { temperatura?: number; procalcitonina?: number; pcrMgL?: number; neutrofilos?: number }

export type LeituraMarcadores = {
  alterados: string[]
  /** neutrófilos acima de 4.000 e até 5.200: dentro da faixa de corte que a AAP escreve */
  neutrofilosNaFaixa: boolean
  algumInformado: boolean
}

/**
 * Marcadores inflamatórios da AAP 2021 (notas das Figuras 1 a 3): procalcitonina
 * > 0,5 ng/mL, PCR > 20 mg/L e neutrófilos "> 4.000 a 5.200/mm³". De 22 a 60
 * dias, sem procalcitonina, a temperatura > 38,5 °C também conta. Neutrófilos
 * acima de 5.200 contam como alterados; entre 4.000 e 5.200 ficam marcados à
 * parte, porque a diretriz dá uma faixa de corte.
 */
export function marcadoresAap2021(faixa: FaixaAap, m: MarcadoresInformados): LeituraMarcadores {
  const ok = (x?: number): x is number => x !== undefined && Number.isFinite(x) && x > 0
  const alterados: string[] = []
  if (ok(m.procalcitonina) && m.procalcitonina > 0.5) alterados.push('procalcitonina > 0,5 ng/mL')
  if (ok(m.pcrMgL) && m.pcrMgL > 20) alterados.push('PCR > 20 mg/L')
  if (ok(m.neutrofilos) && m.neutrofilos > 5200) alterados.push('neutrófilos > 5.200/mm³')
  if (faixa !== '8-21' && !ok(m.procalcitonina) && ok(m.temperatura) && m.temperatura > 38.5) alterados.push('temperatura > 38,5 °C (sem procalcitonina)')
  return {
    alterados,
    neutrofilosNaFaixa: ok(m.neutrofilos) && m.neutrofilos > 4000 && m.neutrofilos <= 5200,
    algumInformado: [m.procalcitonina, m.pcrMgL, m.neutrofilos].some(ok),
  }
}

export type LeituraPecarn = 'baixo-risco' | 'nao-baixo-risco'

/**
 * Regra do PECARN (Kuppermann 2019), lactente de até 60 dias: baixo risco de
 * infecção bacteriana grave com urina negativa, neutrófilos ≤ 4.090/µL e
 * procalcitonina ≤ 1,71 ng/mL. Precisa dos três.
 */
export function pecarn2019(m: { urinaNegativa?: boolean; neutrofilos?: number; procalcitonina?: number }): LeituraPecarn | null {
  if (m.urinaNegativa === undefined || !Number.isFinite(m.neutrofilos) || !Number.isFinite(m.procalcitonina)) return null
  if (m.neutrofilos! < 0 || m.procalcitonina! < 0) return null
  return m.urinaNegativa && m.neutrofilos! <= 4090 && m.procalcitonina! <= 1.71 ? 'baixo-risco' : 'nao-baixo-risco'
}

export const PECARN_DESEMPENHO = 'Validação: sensibilidade 97,7%, especificidade 60,0%, valor preditivo negativo 99,6%; nenhuma meningite bacteriana perdida, um bacteriêmico e dois com ITU classificados como baixo risco (resumo de Kuppermann 2019). Os autores pedem nova validação antes do uso clínico.'

export const ELEGIBILIDADE_AAP = 'Lactente em bom estado geral, de 8 a 60 dias, nascido de 37 a < 42 semanas, com temperatura retal ≥ 38,0 °C em casa nas últimas 24 h ou no atendimento. Ficam de fora: prematuros; menores de 2 semanas com febre, infecção ou antibiótico materno no periparto; suspeita alta de herpes (ex.: vesículas); infecção bacteriana focal; bronquiolite clínica.'

export type KasAap = { kas: string; texto: string; grau: string }

/** KAS da AAP 2021 por faixa, resumidos (grau de evidência e força). */
export const KAS_AAP_2021: Record<FaixaAap, KasAap[]> = {
  '8-21': [
    { kas: '1–2', texto: 'Urina por sondagem ou punção suprapúbica (cultura se exame positivo) e hemocultura', grau: 'A, forte' },
    { kas: '3', texto: 'Pode dosar marcadores inflamatórios', grau: 'B, fraca' },
    { kas: '4', texto: 'Colher liquor (células, proteína, glicose, Gram e cultura)', grau: 'A, forte' },
    { kas: '5–6', texto: 'Antibiótico parenteral e observação hospitalar com equipe experiente em neonatos', grau: 'A, forte; B, moderada' },
    { kas: '7a', texto: 'Suspender o antibiótico e dar alta com culturas negativas por 24–36 h, bebê bem e sem outro motivo de internação', grau: 'B, forte' },
  ],
  '22-28': [
    { kas: '8–10', texto: 'Urina, hemocultura e marcadores inflamatórios', grau: 'A, forte; B, forte' },
    { kas: '11b', texto: 'Colher liquor se algum marcador obtido estiver alterado', grau: 'B, moderada' },
    { kas: '11a', texto: 'Pode colher liquor mesmo com marcadores normais, hemocultura e urocultura colhidas e bebê internado', grau: 'C, moderada' },
    { kas: '12a', texto: 'Antibiótico parenteral internado se o liquor sugerir meningite ou a urina for positiva', grau: 'A, forte' },
    { kas: '13a', texto: 'Pode ir para casa com urina normal, marcadores normais, liquor normal ou enterovírus positivo, orientação e reavaliação em 24 h garantidas', grau: 'B, moderada' },
    { kas: '13b', texto: 'Internar se o liquor não foi colhido ou não é interpretável', grau: 'B, fraca' },
  ],
  '29-60': [
    { kas: '15–17', texto: 'Urina (saco coletor ou jato aceitos para triagem; cultura por sondagem se positivo), hemocultura e marcadores inflamatórios', grau: 'A, forte; B, moderada' },
    { kas: '18a', texto: 'Pode colher liquor se algum marcador estiver alterado', grau: 'C, fraca' },
    { kas: '18b', texto: 'Não precisa colher liquor se todos os marcadores estiverem normais', grau: 'B, moderada' },
    { kas: '19c', texto: 'Antibiótico oral se urina positiva, marcadores normais e liquor normal (se colhido)', grau: 'B, forte' },
    { kas: '19d', texto: 'Sem antibiótico enquanto aguarda culturas se urina negativa e marcadores normais', grau: 'B, moderada' },
    { kas: '20a–b', texto: 'Internar se o liquor estiver alterado; pode internar se algum marcador estiver alterado', grau: 'A, forte; B, moderada' },
  ],
}

export const ERRATA_AAP_LIQUOR =
  'Na AAP 2021 o título do KAS 11b diz "se mais de 1 marcador obtido estiver alterado" (C, moderada) e o quadro-resumo diz "se algum marcador obtido estiver positivo" (B, moderada). A ferramenta mostra o quadro-resumo e registra a divergência.'

export const DIFERENCAS_ICR_AAP: { tema: string; livro: string; aap: string }[] = [
  { tema: 'Faixas de idade', livro: '0–21 dias, 22–90 dias (corte em 60 para a ceftriaxona) e 3–24 meses (Figuras 1–3)', aap: '8–21, 22–28 e 29–60 dias; menos de 8 dias e prematuros ficam de fora' },
  { tema: 'Marcadores', livro: 'PCR > 20 mg/L; neutrófilos > 4.000 abaixo de 90 dias; procalcitonina fora dos fluxogramas (p. 463–464)', aap: 'Procalcitonina > 0,5 ng/mL, PCR > 20 mg/L, neutrófilos > 4.000 a 5.200; temperatura > 38,5 °C conta sem procalcitonina (22–60 dias)' },
  { tema: 'Liquor', livro: 'Fluxo de sepse com liquor até 21 dias; depois, conforme o hemograma (Figuras 1–2)', aap: '8–21 dias sempre; 22–28 dias se algum marcador alterado; 29–60 dias pode colher se algum marcador alterado' },
  { tema: 'Antibiótico e internação', livro: 'Até 21 dias: internar e cefalosporina EV; urina alterada < 60 dias: ceftriaxona EV internado (Figuras 1–2)', aap: '29–60 dias com urina positiva e marcadores normais: antibiótico oral; urina negativa e marcadores normais: sem antibiótico enquanto aguarda culturas' },
  { tema: 'Doses', livro: 'Doses do livro e do Apêndice (decisão do RT: só do ICr)', aap: 'Não entram na ferramenta' },
]

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
