import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP4, type DoseLivro } from './fonteP4.ts'

// Pneumonias — livro do ICr, cap. 30 (p. 307–318). Antibioticoterapia empírica
// domiciliar (Tabela 3) e hospitalar (Tabela 4) por faixa etária e peso,
// situações especiais, sinais de gravidade e leitura do líquido pleural (dica
// da p. 314). A faixa "< 2 meses" da Tabela 4 inclui o período neonatal e é a
// única que calcula para o RN, exceto a ceftriaxona (o Apêndice, p. 899, diz
// que não deve ser usada em neonatos).
//
// Versão .1 de 28/09/2026: PAC complicada pelo documento científico da SBP
// 2024 (PDF lido: Quadro 2 de doses, indicações de drenagem, fibrinolítico) e
// derrame parapneumônico pela atualização IDSA/PIDS 2026 (recomendações lidas
// em resumo; texto integral bloqueado).

export const SBP_2024_PACC: Fonte = {
  citacao: 'Sociedade Brasileira de Pediatria, Departamentos de Pneumologia e Infectologia. Pneumonias Adquiridas na Comunidade Complicadas: Atualização 2024. Documento Científico nº 151, 29/04/2024. Quadro 2 (p. 9–10), drenagem e fibrinolítico (p. 11–13).',
  url: 'https://www.sbp.com.br/fileadmin/user_upload/24347d-DC_PneumoniaAdquiridas_ComunidadeComplicada-Atualiza2024.pdf',
  pediatrica: true,
}

export const IDSA_PIDS_2026_DERRAME: Fonte = {
  citacao: 'Infectious Diseases Society of America / Pediatric Infectious Diseases Society. 2026 Clinical Practice Guideline Update on the Management of Community-Acquired Pneumonia in Infants and Children Older than 3 Months: The Use of Pleural Fluid Drainage versus Observation. Clin Infect Dis. 2026 (on-line; resumo das recomendações lido; texto integral não aberto).',
  url: 'https://doi.org/10.1093/cid/ciag188',
  pediatrica: true,
}

const basePneumonia = fichaP4('ped-pneumonia', 'Pneumonia adquirida na comunidade — criança', 'cap. 30, p. 307–318; Apêndice, p. 898–909')

export const fichaPneumoniaPed: Ficha = {
  ...basePneumonia,
  versao: '2026-09-28.1',
  fontes: [...basePneumonia.fontes, SBP_2024_PACC, IDSA_PIDS_2026_DERRAME],
  revisadoEm: '28/09/2026 (SBP 2024 lida no PDF; IDSA/PIDS 2026 pelo resumo; livro do ICr mantido como base)',
}

const SBP_Q2 = 'SBP 2024, Quadro 2 (p. 9–10)'

/** Quadro 2 da SBP 2024: antibióticos IV na PAC complicada (crianças; máximos do próprio quadro). */
export const DOSES_SBP_2024: DoseLivro[] = [
  { id: 'sbp-ampi', nome: 'Ampicilina', unidade: 'mg', porKgDia: [150, 200], doses: [4, 4], maxDia: 12_000, via: 'IV de 6/6 h', pagina: SBP_Q2 },
  { id: 'sbp-ampi-sulb', nome: 'Ampicilina-sulbactam (dose de ampicilina)', unidade: 'mg', porKgDia: [150, 200], doses: [4, 4], via: 'IV', pagina: SBP_Q2 },
  { id: 'sbp-pen', nome: 'Penicilina cristalina', unidade: 'UI', porKgDia: [200_000, 250_000], doses: [4, 6], maxDia: 24_000_000, via: 'IV de 6/6 ou 4/4 h', pagina: SBP_Q2 },
  { id: 'sbp-oxa', nome: 'Oxacilina', unidade: 'mg', porKgDia: [200, 200], doses: [4, 4], maxDia: 12_000, via: 'IV de 6/6 h', pagina: SBP_Q2 },
  { id: 'sbp-ceftri', nome: 'Ceftriaxona', unidade: 'mg', porKgDia: [50, 100], doses: [2, 2], maxDia: 4000, via: 'IV de 12/12 h', pagina: SBP_Q2 },
  { id: 'sbp-cefotax', nome: 'Cefotaxima', unidade: 'mg', porKgDia: [150, 150], doses: [3, 4], maxDia: 8000, via: 'IV de 8/8 ou 6/6 h', pagina: SBP_Q2 },
  { id: 'sbp-vanco', nome: 'Vancomicina (MRSA comunitário prevalente)', unidade: 'mg', porKgDia: [40, 60], doses: [3, 4], maxDia: 4000, via: 'IV de 6/6 ou 8/8 h', pagina: SBP_Q2 },
  { id: 'sbp-amoxclav', nome: 'Amoxicilina-clavulanato (dose de amoxicilina)', unidade: 'mg', porKgDia: [75, 75], doses: [3, 3], maxDose: 1000, via: 'de 8/8 h', pagina: SBP_Q2 },
  { id: 'sbp-linez', nome: 'Linezolida — < 12 anos', unidade: 'mg', porKgDia: [30, 30], doses: [3, 3], maxDose: 600, via: 'de 8/8 h (≥ 12 anos: 600 mg 8/8 h)', pagina: SBP_Q2 },
  { id: 'sbp-levo-menor5', nome: 'Levofloxacino — 6 meses a < 5 anos', unidade: 'mg', porKgDia: [20, 20], doses: [2, 2], maxDia: 750, via: 'de 12/12 h', pagina: SBP_Q2 },
  { id: 'sbp-levo-maior5', nome: 'Levofloxacino — 5 a < 16 anos', unidade: 'mg', porKgDia: [10, 10], doses: [1, 1], maxDia: 750, via: '1 vez ao dia', pagina: SBP_Q2 },
  { id: 'sbp-azitro', nome: 'Azitromicina (dias 1 e 2; depois 5 mg/kg/dia)', unidade: 'mg', porKgDia: [10, 10], doses: [1, 1], maxDia: 500, via: '1 vez ao dia', pagina: SBP_Q2 },
  { id: 'sbp-metro', nome: 'Metronidazol', unidade: 'mg', porKgDia: [30, 30], doses: [4, 4], maxDia: 4000, via: 'de 6/6 h', pagina: SBP_Q2 },
  { id: 'sbp-amica', nome: 'Amicacina', unidade: 'mg', porKgDia: [15, 15], doses: [2, 2], via: 'IV de 12/12 h', pagina: SBP_Q2 },
]

export const ESQUEMAS_SBP_2024: { situacao: string; texto: string; pagina: string }[] = [
  { situacao: 'Internada com derrame e boas condições', texto: 'penicilina cristalina ou ampicilina, além da abordagem cirúrgica adequada; macrolídeo se suspeita de M. pneumoniae/C. pneumoniae; parenteral prolongado, ao menos 2–3 semanas', pagina: 'p. 9' },
  { situacao: 'Grave', texto: 'ceftriaxona ou cefotaxima (cobrindo S. pneumoniae e S. aureus); onde o MRSA comunitário é prevalente, vancomicina como agente adicional de 1ª linha até a cultura; linezolida ou clindamicina como alternativa; ceftarolina em monoterapia é opção', pagina: 'p. 9' },
  { situacao: 'Muito grave (choque, ventilação, UTI)', texto: 'vancomicina + ceftriaxona ou cefotaxima + azitromicina; oseltamivir na sazonalidade do influenza', pagina: 'p. 9' },
  { situacao: 'Necrosante e abscesso', texto: 'amplo espectro (vancomicina + cefotaxima, ceftriaxona ou cefepima) por 3–4 semanas; tratamento do abscesso em geral conservador', pagina: 'p. 10' },
]

export const DRENAGEM_SBP_2024 = {
  indicacoes: ['Pus no espaço pleural', 'Germes Gram-positivos na coloração', 'Glicose abaixo de 50 mg/dL', 'LDH acima de 1.000 UI', 'Comprometimento da função pulmonar por derrame extenso', 'Septações ou loculações na cavidade torácica'],
  falha: ['Persistência ou aumento da febre após 72 h da drenagem', 'Débito escasso com persistência da imagem'],
  retirada: 'débito mínimo: 40–60 mL em 24 h ou abaixo de 1–1,5 mL/kg/dia; avaliar o volume a cada 24 h',
  fibrinolitico: 'uroquinase (mais descrita, menos alergênica) 2 vezes ao dia ou alteplase 1 vez ao dia por 3 dias (ciclo repetível por mais 3); clampear ~4 h com mudanças posturais',
  empiema: 'pus franco, Gram positivo ou leucócitos ≥ 15 × 10⁶/L; pH < 7,20, proteína > 30 g/L, glicose < 2,2 mmol/L (≈ 40 mg/dL), DHL frequentemente ≥ 1.000 U/L',
  pagina: 'p. 7, 11–13',
}

/** Uroquinase intrapleural pela SBP 2024 (p. 12–13): 10.000 UI em 10 mL de SF (< 1 ano) ou 40.000 UI em 40 mL (≥ 1 ano). */
export function uroquinasePleural(idadeMeses: number): { ui: number; mlSf: number } | null {
  if (!Number.isFinite(idadeMeses) || idadeMeses < 0) return null
  return idadeMeses < 12 ? { ui: 10_000, mlSf: 10 } : { ui: 40_000, mlSf: 40 }
}

export const DERRAME_IDSA_2026: { tema: string; texto: string }[] = [
  { tema: 'Derrame pequeno, não complicado', texto: 'Sugere observação em vez de drenagem imediata (podem melhorar só com antibiótico)' },
  { tema: 'Derrame moderado com desconforto respiratório, grande ou purulento', texto: 'Recomenda drenagem pleural' },
  { tema: 'Imagem', texto: 'Derrame moderado a grande na radiografia: ultrassom de tórax em vez de TC ou RM para tamanho e complexidade' },
  { tema: 'Dreno', texto: 'Dreno de fino calibre (≤ 12 Fr) em vez de calibroso (≥ 14 Fr)' },
  { tema: 'Empiema com drenagem indicada', texto: 'Dreno + fibrinolítico intrapleural em vez de desbridamento cirúrgico como 1ª linha na maioria; tPA isolado em vez de tPA + DNase (dose de tPA não conferida)' },
]

export const DIFERENCAS_PAC_2024: string[] = [
  'Líquido pleural: o livro usa pH < 7,1, glicose < 40 e DHL > 1.000 (p. 314); a SBP 2024 indica drenagem simples com pus, Gram positivo, glicose < 50 mg/dL, LDH > 1.000, derrame extenso ou septações (p. 13) e caracteriza o empiema com pH < 7,20 (p. 7).',
  'Doses: penicilina cristalina 100.000 UI/kg/dia (Tabela 4 do livro) × 200.000–250.000 U/kg/dia na PAC complicada (SBP, Quadro 2); ceftriaxona 100 mg/kg/dia × 50–100; ampicilina 200 × 150–200 mg/kg/dia.',
  'Duração: o livro dá 10–14 dias (pneumococo) e 3–4 semanas (estafilococo) no derrame (p. 314); a SBP fala em parenteral por ao menos 2–3 semanas na complicada e 3–4 na necrosante/abscesso (p. 9–10).',
  'IDSA/PIDS 2026: observar o derrame pequeno; ultrassom em vez de TC; dreno fino + fibrinolítico (tPA isolado) antes da cirurgia — o livro não trata da técnica de drenagem.',
]

export type FaixaPac = 'menor2m' | '2m5a' | 'maior5a'

export const ROTULO_FAIXA: Record<FaixaPac, string> = { menor2m: '< 2 meses', '2m5a': '2 meses a 5 anos', maior5a: '> 5 anos' }

/** Faixa da Tabela 3/4 pela idade em meses completos. 60 meses exatos (5 anos): o livro diz "2 meses-5 anos" e "> 5 anos" → entra em 2m–5a. */
export function faixaPac(idadeMeses: number): FaixaPac | null {
  if (!Number.isFinite(idadeMeses) || idadeMeses < 0) return null
  if (idadeMeses < 2) return 'menor2m'
  return idadeMeses <= 60 ? '2m5a' : 'maior5a'
}

const AP_CEFTRIAXONA = 'máx. do Apêndice: 2 g/dose (p. 899)'
const AP_CLARITRO = 'máx. do Apêndice: 500 mg/dose (p. 900)'
const AP_CEFUROXIMA_VO = 'máx. do Apêndice: VO 500 mg/dose (p. 900)'
const AP_CEFUROXIMA_IV = 'máx. do Apêndice: IV 6 g/dia (p. 900)'

const amox: DoseLivro = { id: 'amox', nome: 'Amoxicilina', unidade: 'mg', porKgDia: [50, 50], doses: [2, 2], via: 'VO de 12/12 h', pagina: 'p. 312 (Tabela 3)' }
const amoxclav: DoseLivro = { id: 'amoxclav', nome: 'Amoxicilina + clavulanato (falha)', unidade: 'mg', porKgDia: [50, 50], doses: [2, 2], via: 'VO de 12/12 h (dose de amoxicilina)', pagina: 'p. 312 (Tabela 3)',
  nota: 'O máximo do Apêndice depende da apresentação (p. 898) e não é aplicado.' }
const cefurVo: DoseLivro = { id: 'cefur-vo', nome: 'Axetil-cefuroxima (falha)', unidade: 'mg', porKgDia: [30, 30], doses: [2, 2], maxDose: 500, fonteMaximo: AP_CEFUROXIMA_VO, via: 'VO de 12/12 h', pagina: 'p. 312 (Tabela 3)' }
const claritroVo: DoseLivro = { id: 'claritro', nome: 'Claritromicina', unidade: 'mg', porKgDia: [15, 15], doses: [2, 2], maxDose: 500, fonteMaximo: AP_CLARITRO, via: 'VO de 12/12 h', pagina: 'p. 312' }
const azitro: DoseLivro = { id: 'azitro', nome: 'Azitromicina', unidade: 'mg', porKgDia: [10, 10], doses: [1, 1], maxDia: 500, fonteMaximo: 'máx. do Apêndice: 500 mg/dia (p. 898)', via: 'VO 1 vez ao dia', pagina: 'p. 312' }

/** Tabela 3 (p. 312): domiciliar, acima de 2 meses. */
export const DOMICILIAR: Record<'2m5a' | 'maior5a', { inicial: DoseLivro[]; falha: DoseLivro[] }> = {
  '2m5a': { inicial: [amox], falha: [amoxclav, cefurVo] },
  maior5a: {
    inicial: [amox, claritroVo, azitro],
    falha: [amoxclav, cefurVo],
  },
}

export const NOTA_MAIOR5 = 'Maiores de 5 anos que começaram com amoxicilina: a falha deve ser abordada com macrolídeo (claritromicina ou azitromicina) (p. 312).'

const ampi: DoseLivro = { id: 'ampi', nome: 'Ampicilina', unidade: 'mg', porKgDia: [200, 200], doses: [4, 4], via: 'EV de 6/6 h', pagina: 'p. 313 (Tabela 4)' }
const penCrist: DoseLivro = { id: 'pen-crist', nome: 'Penicilina cristalina', unidade: 'UI', porKgDia: [100_000, 100_000], doses: [6, 6], maxDia: 24_000_000, fonteMaximo: 'máx. do Apêndice: 24 milhões UI/dia (p. 906)', via: 'EV de 4/4 h', pagina: 'p. 313 (Tabela 4)' }
const cefurIv: DoseLivro = { id: 'cefur-iv', nome: 'Cefuroxima (falha)', unidade: 'mg', porKgDia: [100, 150], doses: [3, 3], maxDia: 6000, fonteMaximo: AP_CEFUROXIMA_IV, via: 'EV de 8/8 h', pagina: 'p. 313 (Tabela 4)' }
const ceftri: DoseLivro = { id: 'ceftri', nome: 'Ceftriaxona (falha)', unidade: 'mg', porKgDia: [100, 100], doses: [2, 2], maxDose: 2000, fonteMaximo: AP_CEFTRIAXONA, via: 'EV de 12/12 h', pagina: 'p. 313 (Tabela 4)' }

/** Tabela 4 (p. 313): hospitalar. `neonatal` só na faixa < 2 meses, exceto ceftriaxona. */
export const HOSPITALAR: Record<FaixaPac, { inicial: DoseLivro[]; falha: DoseLivro[] }> = {
  menor2m: {
    inicial: [
      { ...ampi, neonatal: true },
      { id: 'amicacina', nome: 'Amicacina (com a ampicilina)', unidade: 'mg', porKgDia: [15, 15], doses: [2, 2], via: 'EV de 12/12 h (aminoglicosídeo pode ser em dose única diária)', pagina: 'p. 313 (Tabela 4)', neonatal: true },
      { id: 'genta', nome: 'Gentamicina (alternativa à amicacina)', unidade: 'mg', porKgDia: [3, 7.5], doses: [3, 3], via: 'EV de 8/8 h (aminoglicosídeo pode ser em dose única diária)', pagina: 'p. 313 (Tabela 4)', neonatal: true },
    ],
    falha: [
      { id: 'cefotax', nome: 'Cefotaxima (falha)', unidade: 'mg', porKgDia: [100, 200], doses: [3, 4], via: 'EV de 6/6 ou 8/8 h', pagina: 'p. 313 (Tabela 4)', neonatal: true },
      { ...ceftri, nota: 'O Apêndice (p. 899) diz que a ceftriaxona não deve ser usada em neonatos.' },
    ],
  },
  '2m5a': { inicial: [penCrist, ampi], falha: [cefurIv, ceftri] },
  maior5a: {
    inicial: [penCrist, ampi],
    falha: [cefurIv, ceftri, { ...claritroVo, id: 'claritro-h', nome: 'Claritromicina (associada, falha)', via: 'VO ou EV de 12/12 h', pagina: 'p. 313 (Tabela 4)' }],
  },
}

/** Situações especiais (p. 312–313). */
export const ESPECIAIS: { titulo: string; doses: DoseLivro[] }[] = [
  {
    titulo: 'Lactente de 3 semanas a 3 meses, febril, infiltrado heterogêneo sem opacidade lobar (suspeita de Chlamydia trachomatis) — 10 dias',
    doses: [
      { id: 'eritro-ct', nome: 'Eritromicina', unidade: 'mg', porKgDia: [30, 50], doses: [4, 4], maxDia: 2000, fonteMaximo: 'máx. do Apêndice: 2 g/dia (p. 901)', via: 'VO de 6/6 h', pagina: 'p. 312' },
      { ...claritroVo, id: 'claritro-ct' },
    ],
  },
  {
    titulo: 'Tosse coqueluchoide (suspeita de Bordetella pertussis) — 10 a 14 dias',
    doses: [
      { id: 'eritro-bp', nome: 'Eritromicina', unidade: 'mg', porKgDia: [30, 50], doses: [4, 4], maxDose: 500, fonteMaximo: 'máx. do Apêndice (pertussis): 500 mg/dose (p. 901)', via: 'VO de 6/6 h', pagina: 'p. 313',
        nota: 'Apêndice (p. 901): pertussis 40 a 50 mg/kg/dia por 14 dias.' },
      { ...claritroVo, id: 'claritro-bp', pagina: 'p. 313' },
    ],
  },
  {
    titulo: 'Pneumonia afebril com obstrução de via aérea inferior ou traqueobronquite',
    doses: [
      { ...claritroVo, id: 'claritro-af', via: 'VO de 12/12 h por 10 a 14 dias', pagina: 'p. 313' },
      { ...azitro, id: 'azitro-af', via: 'VO 1 vez ao dia por 5 dias', pagina: 'p. 313' },
    ],
  },
]

export const NOTA_ERITRO_RN =
  'O Apêndice (p. 901) associa a eritromicina nas primeiras 6 semanas de vida à estenose hipertrófica do piloro, com maior risco nas 2 primeiras semanas.'

/** Dica da p. 314: leitura do líquido pleural seroso. */
export function lerLiquidoPleural(ph: number, glicose: number, dhl: number): 'benigno' | 'infectado' | 'intermediario' | null {
  if (![ph, glicose, dhl].every((x) => Number.isFinite(x) && x > 0)) return null
  if (ph > 7.1 && glicose > 60 && dhl < 1000) return 'benigno'
  if (ph < 7.1 && glicose < 40 && dhl > 1000) return 'infectado'
  return 'intermediario'
}

export const TEXTO_PLEURAL: Record<'benigno' | 'infectado' | 'intermediario', string> = {
  benigno: 'pH > 7,1, glicose > 60 mg/dL e DHL < 1.000 UI/L: o livro chama de derrame benigno em fase exsudativa, sem necessidade inicial de drenagem (p. 314).',
  infectado: 'pH < 7,1, glicose < 40 mg/dL e DHL > 1.000 UI/L: com bacterioscopia, cultura ou testes imunológicos positivos, o livro chama de derrame infectado em evolução para empiema, com drenagem (p. 314).',
  intermediario: 'Os valores não caem inteiros em nenhum dos dois grupos da dica da p. 314 — o livro não classifica essa combinação.',
}

export const GRAVIDADE_PAC: { faixa: string; sinais: string; pagina: string }[] = [
  { faixa: '< 2 meses', sinais: 'FR > 60 irpm, tiragem subcostal, febre alta ou hipotermia, recusa persistente de mamadas, sibilância, letargia, sonolência ou irritabilidade anormais', pagina: 'p. 309' },
  { faixa: '> 2 meses', sinais: 'Tiragem subcostal, recusa de líquidos, convulsão, alteração do nível de consciência e vômitos incoercíveis', pagina: 'p. 309' },
]

export const INTERNACAO_PAC =
  'Critérios de internação (variam entre instituições): toxemia ou sepse, hipoxemia, insuficiência respiratória, incapacidade de tolerar VO, fatores sociais, < 2 meses, doença de base (anemia falciforme, síndrome nefrótica, imunodeficiências) e complicações (derrame, abscesso, pneumatocele, pneumotórax) (p. 312).'

export const ERRATA_PAC =
  'O texto escreve "PCr ≥ 150 mg/mL" como corte sugestivo de infecção bacteriana (p. 311); a unidade usual da PCR é mg/L. Não é usado em cálculo.'

export const DURACAO_DERRAME = 'Derrame estafilocócico não complicado: mínimo de 3 a 4 semanas; H. influenzae, pneumococo e outros estreptococos: 10 a 14 dias (p. 314). Abscesso: 2 a 3 semanas parenteral e 4 a 8 semanas VO (p. 315).'
