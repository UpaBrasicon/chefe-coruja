import { completo, escolha, marcadas, numero, somar, type Escore, type Respostas } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'
import type { Faixa } from './pcr.ts'

// Trauma do adulto — Manual de Medicina de Emergência do HCFMUSP (3ª ed.,
// 2022): cap. 47 Atendimento inicial do politraumatizado (p. 636–657) e cap.
// 48 Atendimento pré-hospitalar (p. 658–677). NEXUS e regra canadense como o
// livro imprime (Tabela 1, p. 641–642), MGAP e Triage-RTS (p. 671–672), e as
// contas de tempo e volume do cap. 47. Hipotensão permissiva e ABC score já
// estão em ressuscitacaoVolemica.ts e transfusao.ts (não duplicados). O livro
// não traz índice de choque, classes do choque hemorrágico nem o RTS
// completo (com coeficientes). A decisão é do médico (ADR 0007).

export const fichaTraumaAdulto = fichaAdulto(
  'adulto-trauma-inicial',
  'Politraumatizado — tempos e volumes do atendimento inicial (adulto)',
  'cap. 47 Atendimento inicial do politraumatizado, p. 636–657; cap. 48 Atendimento pré-hospitalar, Tabela 3, p. 664',
)

const valido = (x: number) => Number.isFinite(x) && x > 0
const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const sim = (e: Escore, r: Respostas, id: string) => escolha(e, r, id)?.valor === 1

/** Menor de 14 anos: os escores do livro não foram validados em pediatria (p. 643). */
const pediatrico = (idade: number | undefined) => idade !== undefined && idade < 14

// ── NEXUS (Tabela 1, p. 641; p. 643) ────────────────────────────────────────

const NEXUS_ITENS = [
  ['dor', 'Ausência de dor ou fragilidade na linha média cervical posterior'],
  ['intox', 'Sem evidência de intoxicação'],
  ['alerta', 'Paciente alerta (GCS 13–15)'],
  ['deficit', 'Sem déficit neurológico focal'],
  ['distrator', 'Sem outras fontes de dor significativas que prejudicam a atenção do paciente'],
] as const

export const nexus: Escore = {
  ficha: fichaAdulto('adulto-nexus', 'NEXUS — retirada do colar cervical (adulto)', 'cap. 47, Tabela 1, p. 641; restrições na p. 643'),
  descricao: 'Cinco critérios; todos presentes permitem, segundo o livro, retirar o colar sem exame de imagem. Não vale acima de 60 anos nem em criança.',
  itens: [
    { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 0, max: 130 },
    ...NEXUS_ITENS.map(([id, rotulo]) => ({ tipo: 'escolha' as const, id, rotulo, opcoes: NAO_SIM })),
  ],
  calcular(r) {
    if (!completo(nexus, r)) return null
    const idade = numero(nexus, r, 'idade')!
    const faltam = NEXUS_ITENS.filter(([id]) => !sim(nexus, r, id)).map(([, rotulo]) => rotulo)
    const cuidados = [
      'O livro: "NEXUS não pode ser usado em indivíduos > 60 anos" e "CCR e NEXUS não foram validados para utilização na pediatria" (p. 643).',
      'Em paciente inconsciente a lesão cervical não é descartada pelo exame físico; a proteção é prioritária (p. 641).',
    ]
    if (pediatrico(idade) || idade > 60) {
      return {
        rotulo: 'NEXUS', valor: 'não se aplica', nota: idade > 60 ? 'idade acima de 60 anos: fora do uso que o livro admite' : 'menor de 14 anos: sem validação pediátrica no livro',
        estado: 1, derivados: [['Critérios presentes', `${NEXUS_ITENS.length - faltam.length} de 5`]], cuidados,
      }
    }
    return {
      rotulo: 'NEXUS',
      valor: faltam.length === 0 ? 'todos presentes' : `${faltam.length} ausente${faltam.length > 1 ? 's' : ''}`,
      nota: faltam.length === 0 ? 'o livro: pode-se retirar o colar cervical sem exame de imagem' : 'nem todos os critérios estão presentes; o livro só libera sem imagem com os cinco',
      estado: faltam.length === 0 ? 0 : 1,
      derivados: faltam.map((f) => ['Ausente', f] as [string, string]),
      cuidados,
    }
  },
}

// ── Regra canadense da coluna cervical, como o livro imprime (p. 641–642) ────

const MECANISMO = [
  ['queda', 'Queda de mais de 1 m ou 5 degraus'],
  ['axial', 'Carga axial na cabeça (acidente por mergulho)'],
  ['velocidade', 'Colisão em alta velocidade (> 100 km/h)'],
  ['recreacional', 'Acidente com veículo motorizado recreacional'],
  ['ejecao', 'Ejeção de veículo'],
  ['bicicleta', 'Colisão de bicicleta/moto com objeto imóvel'],
] as const
const BAIXO = [
  ['traseira', 'Colisão automobilística simples, sentado na traseira'],
  ['deambulando', 'Estava ou esteve deambulando após o acidente'],
  ['tardia', 'Aparecimento tardio de dor no pescoço'],
] as const

export const regraCanadenseColuna: Escore = {
  ficha: fichaAdulto('adulto-regra-canadense-coluna', 'Regra canadense da coluna cervical (adulto)', 'cap. 47, Tabela 1, p. 641–642; restrição pediátrica na p. 643'),
  descricao: 'Três passos: fatores de alto risco, fatores de baixo risco e rotação ativa do pescoço a 45°, na forma da Tabela 1 do livro',
  itens: [
    { tipo: 'numero', id: 'idade', rotulo: 'Idade (alto risco: > 65 anos)', unidade: 'anos', min: 0, max: 130 },
    ...MECANISMO.map(([id, rotulo]) => ({ tipo: 'marca' as const, id, rotulo, pontos: 1, grupo: '1. Mecanismo perigoso (alto risco)' })),
    { tipo: 'marca', id: 'parestesia', rotulo: 'Parestesias nas extremidades', pontos: 1, grupo: '1. Alto risco' },
    ...BAIXO.map(([id, rotulo]) => ({ tipo: 'marca' as const, id, rotulo, pontos: 1, grupo: '2. Baixo risco' })),
    { tipo: 'escolha', id: 'rotacao', rotulo: '3. Capaz de girar o pescoço 45° para direita e esquerda', opcoes: [
      { rotulo: 'Ainda não avaliado', valor: 0 }, { rotulo: 'Capaz', valor: 1 }, { rotulo: 'Não capaz', valor: 2 },
    ] },
  ],
  calcular(r) {
    if (!completo(regraCanadenseColuna, r)) return null
    const e = regraCanadenseColuna
    const idade = numero(e, r, 'idade')!
    const alto = [...(idade > 65 ? ['Idade > 65 anos'] : []), ...marcadas(e, r).filter((m) => MECANISMO.some(([, t]) => t === m) || m.startsWith('Parestesias'))]
    const baixo = somar(e, r, BAIXO.map(([id]) => id)) > 0
    const rot = escolha(e, r, 'rotacao')!.valor
    const cuidados = [
      'O livro chama a regra de "CCTR (Canadian CT Trauma Rule)" e depois "CCR", e imprime os itens sob o título NEXUS (p. 641–642).',
      'A Tabela 1 indica radiografia quando não há fator de baixo risco, mas a mesma página diz que não há razão para radiografia de coluna cervical se houver TC (sensibilidade 52% x 98%, p. 642).',
      'Não validada em pediatria (p. 643).',
    ]
    if (pediatrico(idade)) return { rotulo: 'Regra canadense', valor: 'não se aplica', nota: 'menor de 14 anos: sem validação pediátrica no livro', estado: 1, derivados: [], cuidados }
    if (alto.length > 0) {
      return { rotulo: 'Regra canadense', valor: 'alto risco', nota: 'o livro: fator de alto risco presente, realizar tomografia de coluna cervical', estado: 2, derivados: alto.map((a) => ['Alto risco', a] as [string, string]), cuidados }
    }
    if (!baixo) {
      return { rotulo: 'Regra canadense', valor: 'sem baixo risco', nota: 'o livro: nenhuma situação de baixo risco, está indicada radiografia (ver cuidado sobre a TC)', estado: 1, derivados: [], cuidados }
    }
    if (rot === 0) return { rotulo: 'Regra canadense', valor: 'passo 3 pendente', nota: 'há fator de baixo risco; falta a rotação ativa a 45°', estado: 1, derivados: [], cuidados }
    if (rot === 2) return { rotulo: 'Regra canadense', valor: 'não gira 45°', nota: 'o livro: está indicada a tomografia de coluna cervical', estado: 2, derivados: [], cuidados }
    return {
      rotulo: 'Regra canadense', valor: 'gira 45°', estado: 0, derivados: [], cuidados,
      nota: 'a Tabela 1 não escreve a conclusão deste passo; o texto diz que a regra pode ser usada para retirar o colar sem exame de imagem em paciente alerta (p. 641)',
    }
  },
}

// ── MGAP (p. 671) ───────────────────────────────────────────────────────────

export const mgap: Escore = {
  ficha: fichaAdulto('adulto-mgap', 'MGAP — gravidade do trauma no pré-hospitalar (adulto)', 'cap. 48 Atendimento pré-hospitalar, p. 670–671'),
  descricao: 'Mecanismo, Glasgow, idade e pressão sistólica; soma de 3 a 29, com as faixas que o livro imprime',
  itens: [
    { tipo: 'escolha', id: 'mecanismo', rotulo: 'Mecanismo de trauma', opcoes: [{ rotulo: 'Fechado (0)', valor: 0 }, { rotulo: 'Aberto (4)', valor: 4 }] },
    { tipo: 'numero', id: 'gcs', rotulo: 'Escala de coma de Glasgow (pontua o próprio valor)', min: 3, max: 15 },
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [{ rotulo: '< 60 anos (5)', valor: 5 }, { rotulo: '≥ 60 anos (0 — o livro não pontua)', valor: 0 }] },
    { tipo: 'escolha', id: 'pas', rotulo: 'Pressão arterial sistólica', opcoes: [{ rotulo: '> 120 mmHg (5)', valor: 5 }, { rotulo: '60–120 mmHg (3)', valor: 3 }, { rotulo: '< 60 mmHg (0)', valor: 0 }] },
  ],
  calcular(r) {
    if (!completo(mgap, r)) return null
    const total = somar(mgap, r) + numero(mgap, r, 'gcs')!
    const faixa = total <= 17 ? '3–17' : total <= 22 ? '18–22' : '23–29'
    const rotuloLivro = total <= 17 ? 'leve' : total <= 22 ? 'moderado' : 'grave'
    return {
      rotulo: 'MGAP',
      valor: String(total),
      unidade: 'de 29',
      nota: `faixa ${faixa} — o livro chama de "${rotuloLivro}" (ver errata)`,
      estado: 1,
      derivados: [['Faixa do livro', `${faixa} ("${rotuloLivro}")`]],
      alerta: 'Errata: nesta escala a pontuação sobe com Glasgow maior, idade < 60 e PAS maior, mas o livro chama 3–17 de "leve" e 23–29 de "grave". Um paciente com Glasgow 3 e PAS < 60 somaria 3 a 7 e cairia em "leve". Os rótulos parecem invertidos; a faixa é mostrada e o rótulo do livro não é usado como gravidade.',
      cuidados: [
        'Desenvolvido pelo SAMU da França para sistemas de APH com médico (p. 671).',
        'O livro dá 5 pontos para idade < 60 anos e não escreve a pontuação de ≥ 60 (lida como 0).',
        'Mecanismo "aberto = 4, fechado = 0" está como o livro imprime; não foi conferido contra o artigo original.',
      ],
    }
  },
}

// ── Triage-RTS (Tabela 4, p. 672) ───────────────────────────────────────────

/** Pontos do Glasgow na Tabela 4: 13–15 = 4; 9–12 = 3; 6–8 = 2; 4–5 = 1; 3 = 0. */
export const pontoGcsRts = (g: number) => (g >= 13 ? 4 : g >= 9 ? 3 : g >= 6 ? 2 : g >= 4 ? 1 : 0)
/** PAS: > 89 = 4; 76–89 = 3; 50–75 = 2; 1–49 = 1; 0 = 0 (valores inteiros). */
export const pontoPasRts = (p: number) => (p > 89 ? 4 : p >= 76 ? 3 : p >= 50 ? 2 : p >= 1 ? 1 : 0)
/** FR: 10–29 = 4; > 29 = 3; 6–9 = 2; 1–5 = 1; 0 = 0. */
export const pontoFrRts = (f: number) => (f > 29 ? 3 : f >= 10 ? 4 : f >= 6 ? 2 : f >= 1 ? 1 : 0)

export const triageRts: Escore = {
  ficha: fichaAdulto('adulto-triage-rts', 'Triage-RTS — escore de trauma revisado de triagem (adulto)', 'cap. 48 Atendimento pré-hospitalar, p. 671–672 (Tabela 4)'),
  descricao: 'Glasgow, PAS e frequência ventilatória, de 0 a 4 cada; soma de 0 a 12',
  itens: [
    { tipo: 'numero', id: 'gcs', rotulo: 'Escala de coma de Glasgow', min: 3, max: 15 },
    { tipo: 'numero', id: 'pas', rotulo: 'Pressão arterial sistólica', unidade: 'mmHg', min: 0, max: 300 },
    { tipo: 'numero', id: 'fr', rotulo: 'Frequência ventilatória', unidade: 'mpm', min: 0, max: 80 },
  ],
  calcular(r) {
    if (!completo(triageRts, r)) return null
    const g = pontoGcsRts(numero(triageRts, r, 'gcs')!)
    const p = pontoPasRts(numero(triageRts, r, 'pas')!)
    const f = pontoFrRts(numero(triageRts, r, 'fr')!)
    const total = g + p + f
    return {
      rotulo: 'Triage-RTS',
      valor: String(total),
      unidade: 'de 12',
      nota: total < 11 ? 'abaixo de 11: o livro indica transporte a um centro de trauma' : '11 ou 12: acima do corte do livro',
      estado: total < 11 ? 2 : 0,
      derivados: [['Glasgow', `${g} ponto(s)`], ['PAS', `${p} ponto(s)`], ['Frequência ventilatória', `${f} ponto(s)`]],
      cuidados: [
        'A Tabela 4 usa faixas inteiras (PAS 76–89 e 50–75, por exemplo); valores com decimal caem na faixa de baixo.',
        'É a versão de triagem (soma simples). O livro não traz o RTS com coeficientes.',
      ],
    }
  },
}

// ── Contas do atendimento inicial (cap. 47) ─────────────────────────────────

export const TXA_TRAUMA = { bolusG: 1, bolusMin: 10, manutG: 1, manutH: 8, janelaH: 3, pagina: 'p. 649 (CRASH-2)' }

export type TxaTrauma = { dentroDaJanela: boolean; bolusMgMin: number; manutMgH: number; totalG: number; minutosRestantes: number }

/** Ácido tranexâmico (p. 649): 1 g IV em 10 min + 1 g IV em 8 h, desde que com menos de 3 h do trauma. */
export function txaTrauma(minutosDesdeTrauma: number): TxaTrauma | null {
  if (!Number.isFinite(minutosDesdeTrauma) || minutosDesdeTrauma < 0) return null
  const janelaMin = TXA_TRAUMA.janelaH * 60
  return {
    dentroDaJanela: minutosDesdeTrauma < janelaMin,
    bolusMgMin: (TXA_TRAUMA.bolusG * 1000) / TXA_TRAUMA.bolusMin,
    manutMgH: (TXA_TRAUMA.manutG * 1000) / TXA_TRAUMA.manutH,
    totalG: TXA_TRAUMA.bolusG + TXA_TRAUMA.manutG,
    minutosRestantes: Math.max(0, janelaMin - minutosDesdeTrauma),
  }
}

export type Hemotorax = { inicialAtinge: boolean; debitoMlH: number | null; debitoAtinge: boolean | null; horasNaJanela: boolean | null }

/**
 * Hemotórax (p. 644–645): drenagem inicial ≥ 1.500 mL, ou drenagem
 * subsequente > 200 mL/h nas próximas 2 a 4 horas → o livro fala em alta
 * probabilidade / possibilidade de toracotomia de urgência.
 */
export function hemotorax(inicialMl: number, subsequenteMl?: number, horas?: number): Hemotorax | null {
  if (!Number.isFinite(inicialMl) || inicialMl < 0) return null
  const temDebito = subsequenteMl !== undefined && horas !== undefined && Number.isFinite(subsequenteMl) && subsequenteMl >= 0 && valido(horas)
  const debito = temDebito ? subsequenteMl! / horas! : null
  return {
    inicialAtinge: inicialMl >= 1500,
    debitoMlH: debito,
    debitoAtinge: debito === null ? null : debito > 200,
    horasNaJanela: temDebito ? horas! >= 2 && horas! <= 4 : null,
  }
}

export const TORNIQUETE_MAX_MIN = 120 // p. 646

/** Minutos restantes até 2 h de torniquete (p. 646); negativo = passou do limite. */
export const torniqueteRestante = (minutosAplicado: number) => (Number.isFinite(minutosAplicado) && minutosAplicado >= 0 ? TORNIQUETE_MAX_MIN - minutosAplicado : null)

export const ALIQUOTA_TRAUMA_ML: Faixa = [250, 500] // p. 646
export const CRISTALOIDE_ANTES_TRANSFUSAO_L: Faixa = [1, 3] // p. 647

/** Cristaloide acumulado em relação aos 1–3 L após os quais o livro diz que a transfusão está bem indicada se instável (p. 647). */
export function cristaloideAcumulado(ml: number): 'abaixo' | 'dentro' | 'acima' | null {
  if (!Number.isFinite(ml) || ml < 0) return null
  const l = ml / 1000
  return l < CRISTALOIDE_ANTES_TRANSFUSAO_L[0] ? 'abaixo' : l <= CRISTALOIDE_ANTES_TRANSFUSAO_L[1] ? 'dentro' : 'acima'
}

export const TRAUMA_REFERENCIAS = [
  { texto: 'Saturação adequada: igual ou superior a 95%', pagina: 'p. 639' },
  { texto: 'IOT de imediato com Glasgow < 8 (p. 640); via aérea definitiva com Glasgow ≤ 8 (p. 649)', pagina: 'p. 640 e 649' },
  { texto: 'Pneumotórax hipertensivo: punção no 5º espaço intercostal, linha axilar média; dreno n. 24 a 28 entre as linhas axilar média e anterior (4º ou 5º EIC)', pagina: 'p. 644' },
  { texto: 'Hemotórax volumoso: > 1.500 mL de sangue; dreno n. 38; cristaloide aquecido a 38 °C', pagina: 'p. 644' },
  { texto: 'Hipotensão permissiva: PAS 80–90 e PAM 50–60 mmHg; TCE grave: PAM > 80 mmHg; alíquotas de 250–500 mL (ver também a tela de ressuscitação volêmica)', pagina: 'p. 646' },
  { texto: 'Transfusão maciça: 10 unidades de concentrado de hemácias nas primeiras 24 h; proporção 1:1:1 plasma, plaquetas e hemácias', pagina: 'p. 647' },
  { texto: 'Lavado peritoneal diagnóstico: 1.000 mL de solução fisiológica (adulto)', pagina: 'p. 648' },
  { texto: 'Glasgow < 15 com mecanismo compatível: supor lesão craniana significativa até prova em contrário', pagina: 'p. 649' },
]

/** Tabela 3 do cap. 48 (p. 664): restrição de movimento da coluna no trauma contuso do adulto. */
export const RMC_ADULTO = ['Paciente > 65 anos', 'Escala de coma de Glasgow < 15 (aguda)', 'Sinais clínicos de intoxicação', 'Lesões de distração', 'Cinemática perigosa', 'Dor ou sensibilidade ou deformidade na coluna', 'Sinais neurológicos focais', 'Barreira linguística']

/** Coluna toracolombar (p. 653): mecanismo de força importante + algum sinal alterado no exame da coluna. */
export const TORACOLOMBAR = {
  mecanismo: ['Queda de > 3 m', 'Ejeção de veículo', 'Colisão de moto', 'Atropelamento por carro ou veículo maior', 'Outra lesão importante que cause distração', '> 60 anos (queda da própria altura deve ser considerada)', 'Rebaixamento do nível de consciência ou intoxicação'],
  exame: ['Dor à palpação da coluna', 'Sinais de trauma direto (equimose, hematoma, desvio evidente)', 'Déficit neurológico consistente com lesão medular'],
  texto: 'O livro diz que a decisão de TC de coluna "geralmente se dá" pela presença de mecanismo de força importante e de algum sinal alterado no exame da coluna; não há regra validada para a coluna toracolombar.',
  pagina: 'p. 653',
}

export const ERRATA_TRAUMA = [
  'p. 640 x p. 649 — corte de IOT por Glasgow: "< 8" e "≤ 8".',
  'p. 641 — regra canadense chamada de "CCTR (Canadian CT Trauma Rule)" e depois "CCR"; itens impressos sob o título NEXUS na Tabela 1.',
  'p. 642 — Tabela 1 indica radiografia sem fator de baixo risco; a mesma página diz que não há razão para radiografia se houver TC.',
  'p. 647 — "10 UI de concentrado de hemácias": lido como 10 unidades.',
  'p. 663 x p. 664 — o texto diz que a Tabela 3 traz critérios de acionamento de suporte avançado; a Tabela 3 é "Quando utilizar restrição de movimento da coluna".',
  'p. 671 — MGAP com rótulos de gravidade invertidos em relação à direção da escala (ver o escore).',
]
