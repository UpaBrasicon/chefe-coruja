import { completo, escolha, numero, somar, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Paralisias flácidas agudas / síndrome de Guillain-Barré — cap. 44 do Manual
// de Medicina de Emergência do HCFMUSP (3ª ed., 2022), p. 598–607. Critérios
// de ventilação (Tabela 4), escore de incapacidade (Tabela 5), EGOS (Tabela 7),
// LCR e as contas por peso de imunoglobulina e plasmaférese.

const CAP = 'cap. 44 Paralisias flácidas agudas'

export const fichaSgbAdulto = fichaAdulto('adulto-guillain-barre', 'Síndrome de Guillain-Barré — imunoterapia, LCR e AAN (adulto)', `${CAP}, p. 602–606`)

const valido = (x: number) => Number.isFinite(x) && x > 0

// ---------------------------------------------------------------------------
// Critérios de ventilação mecânica (Tabela 4, p. 602)

export const criteriosVmSgb: Escore = {
  ficha: fichaAdulto('adulto-criterios-vm-sgb', 'Critérios de ventilação mecânica na SGB (adulto)', `${CAP}, p. 602–603 (Tabela 4)`),
  descricao: 'Quatro critérios maiores (pCO2, pO2, CVF, PImáx) e três menores; o livro considera 1 maior ou 2 menores. Informe o que foi medido.',
  itens: [
    { tipo: 'numero', id: 'pco2', rotulo: 'pCO2', unidade: 'mmHg', min: 5, max: 200, opcional: true },
    { tipo: 'numero', id: 'po2', rotulo: 'pO2', unidade: 'mmHg', min: 10, max: 700, opcional: true },
    { tipo: 'numero', id: 'cvf', rotulo: 'Capacidade vital forçada', unidade: 'mL', min: 50, max: 8000, opcional: true, ajuda: 'Com o peso, a conta dá mL/kg.' },
    { tipo: 'numero', id: 'peso', rotulo: 'Peso (para CVF em mL/kg)', unidade: 'kg', min: 20, max: 300, opcional: true },
    { tipo: 'numero', id: 'pimax', rotulo: 'PImáx (em módulo)', unidade: 'cmH2O', min: 0, max: 200, opcional: true, ajuda: 'Pressão inspiratória negativa máxima: informe o valor absoluto (−25 → 25).' },
    { tipo: 'marca', id: 'tosse', rotulo: 'Dificuldade de tossir', pontos: 1, grupo: 'menor' },
    { tipo: 'marca', id: 'engolir', rotulo: 'Dificuldade de engolir', pontos: 1, grupo: 'menor' },
    { tipo: 'marca', id: 'atelectasia', rotulo: 'Atelectasia', pontos: 1, grupo: 'menor' },
  ],
  calcular(r) {
    const e = criteriosVmSgb
    const pco2 = numero(e, r, 'pco2')
    const po2 = numero(e, r, 'po2')
    const cvf = numero(e, r, 'cvf')
    const peso = numero(e, r, 'peso')
    const pimax = numero(e, r, 'pimax')
    const cvfKg = cvf !== undefined && peso !== undefined ? cvf / peso : undefined
    const menores = somar(e, r, ['tosse', 'engolir', 'atelectasia'])
    if (pco2 === undefined && po2 === undefined && cvf === undefined && pimax === undefined && menores === 0) return null
    const maiores = [
      pco2 !== undefined && pco2 > 48 ? `pCO2 ${pco2} > 48 mmHg` : null,
      po2 !== undefined && po2 < 56 ? `pO2 ${po2} < 56 mmHg` : null,
      cvfKg !== undefined && cvfKg < 15 ? `CVF ${cvfKg.toFixed(1).replace('.', ',')} < 15 mL/kg` : null,
      pimax !== undefined && pimax < 30 ? `PImáx ${pimax} < 30 cmH2O` : null,
    ].filter((x): x is string => x !== null)
    const preenche = maiores.length >= 1 || menores >= 2
    const derivados: [string, string][] = [['Critérios maiores presentes', maiores.length ? maiores.join('; ') : 'nenhum'], ['Critérios menores presentes', String(menores)]]
    if (cvfKg !== undefined) derivados.push(['CVF por peso', `${cvfKg.toFixed(1).replace('.', ',')} mL/kg`])
    return {
      rotulo: 'Critérios da Tabela 4',
      valor: preenche ? 'preenche' : 'não preenche',
      nota: `${maiores.length} maior(es) e ${menores} menor(es); o livro usa 1 maior ou 2 menores`,
      estado: preenche ? 2 : maiores.length + menores > 0 ? 1 : 0,
      derivados,
      alerta: cvf !== undefined && peso === undefined ? 'CVF informada sem peso: o critério do livro é em mL/kg e não foi avaliado.' : undefined,
      cuidados: [
        'CVF e PImáx devem ser obtidas na admissão no pronto-socorro (p. 602).',
        'Critérios não informados não entram na conta: o resultado vale só para o que foi medido.',
        'O livro não traz a regra 20/30/40 (CVF < 20 mL/kg, PImáx < 30, PEmáx < 40); só os cortes da Tabela 4.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// Escore GBS de incapacidade (Tabela 5, p. 604–605)

const INCAPACIDADE = [
  '0 — Assintomático',
  '1 — Sintomas leves e capaz de correr',
  '2 — Anda 10 metros sem ajuda, mas não corre',
  '3 — Anda 10 metros com ajuda',
  '4 — Restrito ao leito ou à cadeira de rodas',
  '5 — Suporte ventilatório em alguma parte do dia',
  '6 — Morte',
]

export const incapacidadeGbs: Escore = {
  ficha: fichaAdulto('adulto-gbs-incapacidade', 'Escore GBS de incapacidade (adulto)', `${CAP}, p. 604–605 (Tabela 5)`),
  descricao: 'Grau funcional de 0 a 6 na síndrome de Guillain-Barré (Tabela 5 do manual do HC).',
  itens: [{ tipo: 'escolha', id: 'grau', rotulo: 'Quadro clínico', opcoes: INCAPACIDADE.map((rotulo, i) => ({ rotulo, valor: i })) }],
  calcular(r) {
    if (!completo(incapacidadeGbs, r)) return null
    const g = escolha(incapacidadeGbs, r, 'grau')!.valor
    return {
      rotulo: 'GBS incapacidade',
      valor: String(g),
      unidade: 'de 6',
      nota: INCAPACIDADE[g].replace(/^\d — /, ''),
      estado: g >= 3 ? 2 : g === 2 ? 1 : 0,
      derivados: [['Referência do livro (p. 604)', g >= 3 ? 'grave acometimento motor (≥ 3): o livro diz que o tratamento não se discute' : g === 2 ? 'grau 2: há tendência atual de também tratar (o livro diz que a decisão é controversa)' : 'casos leves: decisão controversa, muitos autores adotam conduta expectante']],
      cuidados: [
        'Na Tabela 7 (EGOS) o escore entra com o valor de 2 semanas após a admissão (p. 606).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// EGOS (Tabela 7, p. 606)

export const egos: Escore = {
  ficha: fichaAdulto('adulto-egos', 'Erasmus GBS Outcome Score — EGOS (adulto)', `${CAP}, p. 606–607 (Tabela 7 e Figura 1)`),
  descricao: 'Prognóstico de marcha em 6 meses na SGB: idade, diarreia prévia e escore de incapacidade com 2 semanas da admissão (1 a 7).',
  itens: [
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade de início', opcoes: [
      { rotulo: '< 41 anos — 0', valor: 0 }, { rotulo: '41-60 anos — 0,5', valor: 0.5 }, { rotulo: '> 60 anos — 1', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'diarreia', rotulo: 'História de diarreia prévia', opcoes: [{ rotulo: 'Ausente — 0', valor: 0 }, { rotulo: 'Presente — 1', valor: 1 }] },
    { tipo: 'escolha', id: 'gbs', rotulo: 'Escore GBS de incapacidade com 2 semanas da admissão', opcoes: [
      { rotulo: '0 ou 1 — 1', valor: 1 }, { rotulo: '2 — 2', valor: 2 }, { rotulo: '3 — 3', valor: 3 }, { rotulo: '4 — 4', valor: 4 }, { rotulo: '5 — 5', valor: 5 },
    ] },
  ],
  calcular(r) {
    if (!completo(egos, r)) return null
    const total = somar(egos, r)
    return {
      rotulo: 'EGOS',
      valor: total.toLocaleString('pt-BR'),
      unidade: 'de 1 a 7',
      nota: 'Quanto maior, maior a proporção de pacientes sem marcha independente em 6 meses (Figura 1, p. 607)',
      estado: total >= 5 ? 2 : total >= 4 ? 1 : 0,
      derivados: [],
      cuidados: [
        'A Figura 1 do livro é um gráfico sem valores tabulados; a ferramenta não lê percentuais dele.',
        'Outros fatores de pior prognóstico no texto: evolução rápida com grave comprometimento motor, ventilação mecânica, idade > 60 anos, Campylobacter jejuni, CMV prévio, CMAP < 20% do limite inferior (p. 605–606).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// Imunoterapia (p. 604) e AAN (Tabela 6, p. 605–606)

export const IGIV_SGB = { gKgDia: 0.4, dias: 5, pagina: 'p. 604' }
export const PLASMAFERESE_SGB = { mlKgTotal: 250, sessoes: 5, intervalo: 'dias alternados', pagina: 'p. 604' }
export const JANELA_TRATAMENTO_SEMANAS = 4

export type ContaImunoterapia = { igivGDia: number; igivGTotal: number; plasmaMlTotal: number; plasmaMlSessao: number }

export function contaImunoterapiaSgb(pesoKg: number): ContaImunoterapia | null {
  if (!valido(pesoKg)) return null
  const igivGDia = IGIV_SGB.gKgDia * pesoKg
  const plasmaMlTotal = PLASMAFERESE_SGB.mlKgTotal * pesoKg
  return { igivGDia, igivGTotal: igivGDia * IGIV_SGB.dias, plasmaMlTotal, plasmaMlSessao: plasmaMlTotal / PLASMAFERESE_SGB.sessoes }
}

export const AAN_SGB = [
  { terapia: 'Plasmaférese', texto: 'Pacientes que não deambulam dentro de 4 semanas do início dos sintomas', nivel: 'A' },
  { terapia: 'Plasmaférese', texto: 'Pacientes que deambulam com auxílio dentro de 2 semanas do início dos sintomas', nivel: 'B' },
  { terapia: 'Imunoglobulina', texto: 'Pacientes que deambulam com auxílio dentro de 2 semanas do início dos sintomas', nivel: 'A' },
  { terapia: 'Imunoglobulina', texto: 'Pacientes que deambulam com auxílio dentro de 4 semanas do início dos sintomas', nivel: 'B' },
  { terapia: 'Corticosteroides', texto: 'Não há recomendações para uso de corticoides na SGB', nivel: 'A' },
]

// ---------------------------------------------------------------------------
// LCR (p. 603–604)

export type LeituraLcr = { dissociacao: boolean; achados: string[] }

/** Proteína > 50 mg/dL com até 4 células/mm³ = dissociação; > 10 células: outras etiologias; > 50: red flag (p. 603–604). */
export function lerLcrSgb(proteinaMgDl: number, celulasMm3: number): LeituraLcr | null {
  if (!Number.isFinite(proteinaMgDl) || proteinaMgDl < 0 || !Number.isFinite(celulasMm3) || celulasMm3 < 0) return null
  const achados: string[] = []
  const dissociacao = proteinaMgDl > 50 && celulasMm3 <= 4
  if (dissociacao) achados.push('dissociação proteinocitológica: proteína > 50 mg/dL e até 4 células/mm³ (p. 603)')
  else if (proteinaMgDl <= 50) achados.push('proteína até 50 mg/dL: a dissociação pode faltar em até 50% na 1ª semana e 25% na 3ª (p. 603)')
  if (celulasMm3 > 50) achados.push('> 50 células/mm³: red flag para diagnóstico alternativo (p. 604)')
  else if (celulasMm3 > 10) achados.push('> 10 células/mm³: o livro manda considerar outras etiologias (HIV, CMV, lúpus, Hodgkin, Lyme) (p. 603)')
  else if (celulasMm3 > 4) achados.push('5 a 10 células/mm³: o livro não classifica essa faixa')
  return { dissociacao, achados }
}

export const RED_FLAGS_SGB = ['Fraqueza de instalação notadamente assimétrica', 'Disfunção esfincteriana', 'Nível sensitivo', '> 50 células/mm³ no liquor']
