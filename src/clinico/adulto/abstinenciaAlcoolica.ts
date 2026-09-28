import { completo, somar, type Escore, type Item } from '../escore.ts'
import { mgMlDoAnexo } from './estadoDeMal.ts'
import { fichaAdulto } from './fonte.ts'

// Síndrome de abstinência alcoólica — cap. 78 do Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022), p. 1024–1035. O capítulo traz a
// CIWA-Ar (Tabela 3, p. 1028–1030) com a classificação, os critérios de Caine
// (Tabela 4, p. 1031–1032) e as doses em texto (p. 1031–1034). A ferramenta
// soma a escala e mostra o que o livro traz; a escolha da droga é do médico
// (ADR 0007). O mL/h do midazolam usa o preparo padrão do Anexo 1 do mesmo
// livro (p. 1482–1485).

export const fichaAbstinenciaAlcoolica = fichaAdulto(
  'adulto-abstinencia-alcoolica',
  'Síndrome de abstinência alcoólica — adulto',
  'cap. 78 Síndrome de abstinência alcoólica, p. 1024–1035 (Tabelas 1–5); preparo do midazolam: Anexo 1, p. 1482–1485',
)

export type Faixa = [number, number]

// ── CIWA-Ar (Tabela 3, p. 1028–1030) ────────────────────────────────────────

/** Os níveis marcados com * no livro: "gradativamente mais intensos que a pontuação anterior, mas menos que a posterior". */
const intermediario = (n: number) => `${n} — intermediário`

function escala0a7(id: string, rotulo: string, ancoras: Record<number, string>): Item {
  return {
    tipo: 'escolha',
    id,
    rotulo,
    opcoes: Array.from({ length: 8 }, (_, n) => ({ rotulo: ancoras[n] ? `${n} — ${ancoras[n]}` : intermediario(n), valor: n })),
  }
}

export const ITENS_CIWA: Item[] = [
  escala0a7('nauseas', 'Náuseas e vômitos', {
    0: 'sem náuseas, sem vômitos', 1: 'náuseas leves sem vômitos', 4: 'náuseas intermitentes com esforço seco de vômitos',
    7: 'náuseas constantes, esforço seco de vômito e vômitos frequentes',
  }),
  escala0a7('taticos', 'Distúrbios táteis', {
    0: 'nenhum', 1: 'prurido, agulhadas, dormência ou queimação muito leves', 2: 'prurido, agulhadas, dormência leves',
    3: 'prurido, agulhadas, dormência moderados', 4: 'alucinações moderadamente graves', 5: 'alucinações graves', 6: 'alucinações muito graves', 7: 'alucinações contínuas',
  }),
  escala0a7('tremor', 'Tremor', {
    0: 'sem tremor', 1: 'não visível, mas pode ser sentido com a ponta dos dedos', 4: 'moderado com os braços estendidos', 7: 'grave mesmo com os braços não estendidos',
  }),
  escala0a7('auditivos', 'Distúrbios auditivos', {
    0: 'ausentes', 1: 'muito pouco assustadores', 2: 'pouco assustadores', 3: 'moderadamente assustadores',
    4: 'alucinações moderadamente graves', 5: 'alucinações graves', 6: 'alucinações muito graves', 7: 'alucinações contínuas',
  }),
  escala0a7('sudorese', 'Sudorese', {
    0: 'sem sudorese visível', 1: 'sudorese muito leve, mãos úmidas', 4: 'gotas de suor visíveis na fronte', 7: 'sudorese intensa',
  }),
  escala0a7('visuais', 'Distúrbios visuais', {
    0: 'nenhum', 1: 'sensibilidade muito leve', 2: 'sensibilidade leve', 3: 'sensibilidade moderada',
    4: 'alucinações moderadamente graves', 5: 'alucinações graves', 6: 'alucinações muito graves', 7: 'alucinações contínuas',
  }),
  escala0a7('ansiedade', 'Ansiedade', {
    0: 'sem ansiedade', 1: 'ansiedade leve', 4: 'moderadamente ansioso', 7: 'equivalente a estados agudos de pânico',
  }),
  escala0a7('cefaleia', 'Cefaleia ou cabeça pesada', {
    0: 'ausente', 1: 'muito leve', 2: 'leve', 3: 'moderada', 4: 'moderadamente grave', 5: 'grave', 6: 'muito grave', 7: 'extremamente grave',
  }),
  escala0a7('agitacao', 'Agitação', {
    0: 'atividade normal', 1: 'algo mais que atividade normal', 4: 'moderadamente impaciente e incomodado', 7: 'agitação e inquietude extremas',
  }),
  {
    tipo: 'escolha', id: 'orientacao', rotulo: 'Orientação', opcoes: [
      { rotulo: '0 — orientado e pode realizar somas seriadas', valor: 0 },
      { rotulo: '1 — não pode realizar somas seriadas ou incerteza sobre a data', valor: 1 },
      { rotulo: '2 — desorientado para data por não mais de 2 dias', valor: 2 },
      { rotulo: '3 — desorientado para data por mais de 2 dias', valor: 3 },
      { rotulo: '4 — desorientado espacialmente e/ou para pessoas', valor: 4 },
    ],
  },
]

export type FaixaCiwa = 'leve' | 'moderada' | 'grave' | 'sem-faixa'

/**
 * Classificação da p. 1030: leve < 15; moderada 16–20; grave > 20.
 * 15 pontos não cabe em nenhuma faixa do livro (errata abaixo).
 */
export function faixaCiwa(total: number): FaixaCiwa {
  if (total < 15) return 'leve'
  if (total >= 16 && total <= 20) return 'moderada'
  if (total > 20) return 'grave'
  return 'sem-faixa'
}

export const ERRATA_CIWA = {
  faixa15: 'A classificação da p. 1030 é "Leve: < 15; Moderada: 16-20; Grave: > 20": 15 pontos não cai em nenhuma faixa. A Tabela 1 (p. 1026) usa "CIWA-Ar > 15 na admissão" como fator de risco. Com 15 pontos a ferramenta não classifica.',
  cabecalho: 'Nas p. 1029 e 1030 o cabeçalho repetido da Tabela 3 diz "Náuseas e vômitos / Distúrbios táteis", mas o conteúdo é, respectivamente, Tremor / Distúrbios auditivos, Sudorese / Distúrbios visuais, Ansiedade / Cefaleia e Agitação / Orientação (títulos certos no fim da p. 1028 e no meio das tabelas). Os itens foram lidos pelo conteúdo.',
}

const ROTULO_FAIXA: Record<FaixaCiwa, string> = {
  leve: 'leve (< 15 pontos)',
  moderada: 'moderada (16–20 pontos)',
  grave: 'grave (> 20 pontos)',
  'sem-faixa': 'sem faixa no livro (15 pontos)',
}

export const ciwaAr: Escore = {
  ficha: fichaAbstinenciaAlcoolica,
  descricao: 'CIWA-Ar como traz o manual do HC (Tabela 3, p. 1028–1030).',
  itens: ITENS_CIWA,
  calcular(r) {
    if (!completo(ciwaAr, r)) return null
    const total = somar(ciwaAr, r)
    const faixa = faixaCiwa(total)
    const derivados: [string, string][] = [['Classificação (p. 1030)', ROTULO_FAIXA[faixa]]]
    if (total > 15) derivados.push(['Tabela 1 (p. 1026)', 'CIWA-Ar > 15 na admissão está entre os fatores de risco'])
    if (faixa === 'grave') derivados.push(['Texto do manual (p. 1032)', 'com mais de 20 pontos, a via citada para o benzodiazepínico é a parenteral'])
    return {
      rotulo: 'CIWA-Ar',
      valor: String(total),
      unidade: 'de 67',
      nota: `Abstinência ${ROTULO_FAIXA[faixa]}`,
      estado: faixa === 'grave' ? 2 : faixa === 'leve' ? 0 : 1,
      derivados,
      alerta: faixa === 'sem-faixa' ? ERRATA_CIWA.faixa15 : undefined,
      cuidados: [
        'Níveis 2, 3, 5 e 6 sem descrição no livro: intensidade entre a anterior e a seguinte.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ── Critérios de Caine (Tabela 4, p. 1031–1032) ─────────────────────────────

export const CRITERIOS_CAINE = [
  'Déficit nutricional',
  'Alterações cerebelares',
  'Alterações oculomotoras',
  'Alterações de estado mental ou memória',
]

/** "Necessita de dois critérios para diagnóstico" (p. 1032). */
export function caine(marcados: number): { marcados: number; preenche: boolean } {
  const n = Math.max(0, Math.min(CRITERIOS_CAINE.length, Math.floor(marcados)))
  return { marcados: n, preenche: n >= 2 }
}

// ── Doses do capítulo (p. 1031–1034) ────────────────────────────────────────

export type DoseAbstinencia = {
  id: string
  nome: string
  contexto: string
  texto: string
  /** dose por tomada em mg, quando o livro dá número */
  mg?: Faixa
  /** intervalos em horas citados no livro, para a dose diária */
  intervalosH?: number[]
  /** teto diário citado (mg/dia) */
  tetoDiaMg?: Faixa
  pagina: string
  nota?: string
}

export const DOSES_ABSTINENCIA: DoseAbstinencia[] = [
  { id: 'diazepam-vo', nome: 'Diazepam VO', contexto: 'Abstinência leve a moderada', mg: [5, 10], intervalosH: [6, 8],
    texto: '5 a 10 mg VO a cada 6/6 ou 8/8 horas, com ajustes após as primeiras doses; doses rapidamente diminuídas (5 mg ao dia) nos dias seguintes até descontinuar',
    pagina: 'p. 1032' },
  { id: 'diazepam-ev', nome: 'Diazepam EV', contexto: 'Abstinência grave (CIWA-Ar > 20)', mg: [5, 10],
    texto: '5 a 10 mg IV lentamente, conforme a resposta; pode ser repetido a cada 15/15 ou 30/30 minutos',
    pagina: 'p. 1032', nota: 'O manual põe como objetivo o paciente calmo, sem rebaixamento (risco de complicações e aspiração). Não é feito IM.' },
  { id: 'lorazepam-ev', nome: 'Lorazepam EV ou IM', contexto: 'Abstinência grave (CIWA-Ar > 20)', mg: [2, 4],
    texto: '2 a 4 mg IV repetidos a cada 15 a 20 minutos, conforme a necessidade; pode ser usado IM',
    pagina: 'p. 1032' },
  { id: 'vo-grave', nome: 'Lorazepam ou diazepam VO', contexto: 'Abstinência grave, capaz de ingerir VO',
    texto: 'lorazepam 1 a 4 mg ou diazepam 5 a 10 mg de 1/1 hora, com espaçamento progressivo conforme as reavaliações',
    pagina: 'p. 1033', nota: 'O manual cita que esquemas guiados por sintomas usam doses menores que os de dose fixa.' },
  { id: 'midazolam', nome: 'Midazolam EV contínuo', contexto: 'Delirium tremens sem controle com benzodiazepínicos',
    texto: 'bolus inicial de 5 mg, depois 2 mg por hora com adequação da dose; monitorização respiratória',
    pagina: 'p. 1033' },
  { id: 'olanzapina', nome: 'Olanzapina', contexto: 'Associação em agitação extrema com muitas alucinações', mg: [10, 10],
    texto: 'dose inicial de 10 mg (via não informada)', pagina: 'p. 1033',
    nota: 'Neurolépticos baixam o limiar convulsivo; o manual os cita sobretudo após as primeiras 24 a 48 h. Fenotiazinas devem ser evitadas.' },
  { id: 'haloperidol', nome: 'Haloperidol', contexto: 'Associação em agitação extrema com muitas alucinações', mg: [5, 5],
    texto: '5 mg IM', pagina: 'p. 1033' },
  { id: 'carbamazepina', nome: 'Carbamazepina VO', contexto: 'Alternativa aos benzodiazepínicos', mg: [200, 400], intervalosH: [12], tetoDiaMg: [1200, 1600],
    texto: 'iniciar com 200 a 400 mg de 12/12 horas, podendo chegar a 1.200 a 1.600 mg ao dia', pagina: 'p. 1034 (Tabela 5)',
    nota: 'Anticonvulsivantes não são indicados para profilaxia de crises.' },
  { id: 'tiamina-im', nome: 'Tiamina IM', contexto: 'Encefalopatia de Wernicke estabelecida', mg: [100, 200],
    texto: '100 a 200 mg IM, 1 a 2 vezes ao dia', pagina: 'p. 1032' },
  { id: 'tiamina-vo', nome: 'Tiamina VO', contexto: 'Profilaxia (não para tratar Wernicke)',
    texto: '100 a 300 mg ao dia', pagina: 'p. 1032' },
  { id: 'magnesio', nome: 'Sulfato de magnésio', contexto: 'Manter magnésio normal, se necessário',
    texto: '1 a 2 g diluídos em 100 mL de solução salina fisiológica', pagina: 'p. 1032' },
  { id: 'volume-dt', nome: 'Reposição de volume', contexto: 'Delirium tremens',
    texto: 'necessidade de reposição geralmente de 2 litros', pagina: 'p. 1031' },
]

/** Dose diária de um esquema a intervalo fixo (mg por tomada × tomadas/dia). */
export function doseDiaria(mg: Faixa, intervaloH: number): Faixa | null {
  if (!Number.isFinite(intervaloH) || intervaloH <= 0 || 24 % intervaloH !== 0) return null
  const n = 24 / intervaloH
  return [mg[0] * n, mg[1] * n]
}

/** Midazolam no delirium tremens (p. 1033) no preparo padrão do Anexo 1. */
export function midazolamDelirium(): { bolusMg: number; mgH: number; mgMl: number | null; mlH: number | null; bolusMl: number | null } {
  const c = mgMlDoAnexo('midazolam')
  return { bolusMg: 5, mgH: 2, mgMl: c, mlH: c ? 2 / c : null, bolusMl: c ? 5 / c : null }
}

export const SEM_DOSE_NO_CAPITULO = [
  { nome: 'Fenobarbital ou propofol', texto: 'delirium tremens refratário aos benzodiazepínicos, principalmente propofol; exige intubação e ventilação mecânica', pagina: 'p. 1033' },
  { nome: 'Betabloqueadores', texto: 'reduzem taquicardia e tremores, mas pioram delirium; apenas se hipertensão ou taquicardia refratária', pagina: 'p. 1033 (Tabela 5)' },
  { nome: 'Clonidina', texto: 'reduz manifestações autonômicas, sem indicação de rotina', pagina: 'p. 1034 (Tabela 5)' },
  { nome: 'Etanol parenteral', texto: 'melhora sintomas, mas considerado pouco seguro', pagina: 'p. 1034 (Tabela 5)' },
  { nome: 'Barbitúricos', texto: 'eficácia similar em um estudo; evitados por depressão respiratória', pagina: 'p. 1034 (Tabela 5)' },
  { nome: 'Baclofeno', texto: 'um estudo com benefício; não indicado rotineiramente', pagina: 'p. 1034 (Tabela 5)' },
]

export const FATORES_RISCO_SAA = {
  pagina: 'p. 1026 (Tabela 1)',
  itens: [
    'Uso sustentado de álcool',
    'História prévia de delirium tremens ou de internação prévia por síndrome de abstinência',
    'Idade maior que 30 anos',
    'Presença de doença precipitante',
    'Alcoolemia elevada (raramente disponível no Brasil)',
    'Tempo de última dose de álcool maior que 2 dias',
    'Escore CIWA-Ar > 15 na admissão',
    'Uso prévio de benzodiazepínico',
    'Sexo masculino',
  ],
}

export const TEMPOS_SAA = [
  { sindrome: 'Sintomas menores', achados: 'tremores, ansiedade, cefaleia, anorexia, palpitações', tempo: '6–36 h', pagina: 'p. 1026 (Tabela 2)' },
  { sindrome: 'Crises convulsivas', achados: 'tônico-clônicas generalizadas, em geral únicas ou até 6 episódios', tempo: '6–48 h', pagina: 'p. 1027 (Tabela 2)' },
  { sindrome: 'Alucinose', achados: 'visuais ou auditivas, com orientação preservada', tempo: '12–48 h', pagina: 'p. 1027 (Tabela 2)' },
  { sindrome: 'Delirium tremens', achados: 'delirium, agitação, taquicardia, febre, diaforese, crise hipertensiva', tempo: '48–96 h', pagina: 'p. 1027 (Tabela 2)' },
]

export const NOTAS_TEMPO_SAA = 'O texto da p. 1025 dá números um pouco diferentes da Tabela 2: sintomas em geral 6 a 24 h após a última ingesta; convulsões de 12 a 48 h (podendo ocorrer até 2 h após); delirium tremens dura em geral 3 dias, até 14 dias.'
