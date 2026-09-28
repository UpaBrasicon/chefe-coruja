import { fichaAdulto } from './fonte.ts'

// Sedação e analgesia para procedimentos (SAP) do adulto — cap. 10 do Manual
// de Medicina de Emergência do HCFMUSP (3ª ed., 2022), p. 153–166 (Tabelas 1 e
// 2). A ferramenta calcula dose e volume por peso a partir do que o livro traz;
// a escolha da droga, da profundidade e do momento é do médico (ADR 0007).

export const fichaSedacaoProcedimentoAdulto = fichaAdulto(
  'adulto-sedacao-procedimento',
  'Sedação e analgesia para procedimentos — adulto',
  'cap. 10 Sedação e analgesia em procedimentos, p. 153–166 (Tabelas 1 e 2)',
)

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0

export type DrogaSap = {
  id: string
  nome: string
  /** unidade da dose: mg ou µg */
  unidade: 'mg' | 'µg'
  /** concentrações da apresentação citada (unidade/mL) */
  concentracoes: number[]
  apresentacao: string
  inicialPorKg: Faixa
  inicialTexto: string
  repiquePorKg?: Faixa
  repiqueTexto?: string
  /** teto aplicado à dose inicial calculada, na unidade da droga */
  teto?: { valor: number; texto: string; condicional?: 'virgem-opioide' }
  acao: string
  pagina: string
  notas: string[]
  errata?: string
}

export const DROGAS_SAP: DrogaSap[] = [
  {
    id: 'etomidato', nome: 'Etomidato', unidade: 'mg', concentracoes: [2], apresentacao: '20 mg/10 mL (2 mg/mL)',
    inicialPorKg: [0.1, 0.2], inicialTexto: '0,1–0,2 mg/kg EV em 30–60 s',
    repiquePorKg: [0.05, 0.05], repiqueTexto: '0,05 mg/kg a cada 5–15 min para manter a sedação',
    acao: 'início 10–20 s; pico 1 min; duração 2–3 min (dose-dependente)', pagina: 'p. 162 (Tabela 2)',
    notas: [
      'Sem propriedade analgésica: com opioide junto, o livro limita o fentanil a 0,5 µg/kg.',
      'Mioclonias em até 80% dos casos; se graves, o livro cita IOT e midazolam 1–2 mg IV a cada 1 min até ceder.',
      'Pode não ser a melhor opção se o procedimento depender de imobilidade (redução de luxação, exame de imagem).',
      'Contraindicado em menores de 10 anos (p. 162).',
    ],
  },
  {
    id: 'midazolam', nome: 'Midazolam', unidade: 'mg', concentracoes: [5], apresentacao: '15 mg/3 mL ou 50 mg/10 mL (5 mg/mL)',
    inicialPorKg: [0.02, 0.03], inicialTexto: '0,02–0,03 mg/kg EV em 1–2 min',
    repiquePorKg: [0.02, 0.03], repiqueTexto: 'mesma dose, se necessário, a cada 2–5 min',
    teto: { valor: 5, texto: 'em geral, não mais do que 5 mg para procedimentos (e 1–2 mg para ansiólise)' },
    acao: 'EV: início 1–5 min, pico 3–5 min, duração 30–60 min', pagina: 'p. 163 (Tabela 2)',
    notas: ['Preferido para sedação mínima (ansiólise); com opioide, maior risco de eventos adversos.', 'Sedação prolongada em idosos, obesos, insuficiência renal e hepática.'],
  },
  {
    id: 'propofol', nome: 'Propofol', unidade: 'mg', concentracoes: [10, 20], apresentacao: '1% (10 mg/mL) ou 2% (20 mg/mL)',
    inicialPorKg: [0.5, 1], inicialTexto: '0,5–1 mg/kg EV lento',
    repiquePorKg: [0.5, 0.5], repiqueTexto: '0,5 mg/kg a cada 3–5 min',
    acao: 'início 30 s; duração 3–10 min', pagina: 'p. 164 (Tabela 2)',
    notas: [
      'Obeso: bolus inicial pelo peso ideal (o livro não traz a fórmula do peso ideal) e titular pela resposta.',
      'Com opioide junto, o livro limita o fentanil a 0,5 µg/kg; cita quetamina subdissociativa 0,3 mg/kg como opção.',
      'Hipotensão e depressão miocárdica: o livro orienta ressuscitação volêmica antes do uso.',
      'Alergia a ovo e soja não é contraindicação (p. 164).',
    ],
  },
  {
    id: 'propofol-idoso', nome: 'Propofol — idoso', unidade: 'mg', concentracoes: [10, 20], apresentacao: '1% (10 mg/mL) ou 2% (20 mg/mL)',
    inicialPorKg: [0.25, 0.5], inicialTexto: 'dose inicial 0,25–0,5 mg/kg',
    acao: 'início 30 s; duração 3–10 min', pagina: 'p. 164 (Tabela 2)',
    notas: ['O livro não define a idade de corte de "idoso" nesta tabela (na p. 155, risco aumentado acima de 65 anos).'],
  },
  {
    id: 'quetamina-ev', nome: 'Quetamina EV', unidade: 'mg', concentracoes: [50], apresentacao: '500 mg/10 mL (50 mg/mL)',
    inicialPorKg: [1, 2], inicialTexto: '1–2 mg/kg EV em 1–2 min (evitar infusão em menos de 30 s)',
    repiquePorKg: [0.5, 1], repiqueTexto: '0,5–1 mg/kg a cada 5–10 min (manutenção menor, 0,25–0,5 mg/kg, conforme outras drogas e estado clínico)',
    acao: 'início quase imediato; duração 10–20 min', pagina: 'p. 165 (Tabela 2)',
    notas: [
      'Obeso: bolus inicial pelo peso ideal e titular pela resposta.',
      'Não usar em esquizofrenia ou psicose; evitar em hidrocefalia e onde a hipertensão seja deletéria.',
      'Boa escolha em comórbidos (ASA III) e com risco de broncoespasmo; melhor opção para SAP mais prolongada.',
    ],
  },
  {
    id: 'quetamina-im', nome: 'Quetamina IM', unidade: 'mg', concentracoes: [50], apresentacao: '500 mg/10 mL (50 mg/mL)',
    inicialPorKg: [4, 5], inicialTexto: '4–5 mg/kg IM',
    repiquePorKg: [2, 5], repiqueTexto: 'se sedação inadequada após 5–10 min, repetir 2–5 mg/kg',
    acao: 'duração 10–20 min', pagina: 'p. 165 (Tabela 2)', notas: [],
  },
  {
    id: 'quetamina-sub', nome: 'Quetamina — dose analgésica (subdissociativa) EV', unidade: 'mg', concentracoes: [50], apresentacao: '500 mg/10 mL (50 mg/mL)',
    inicialPorKg: [0.1, 0.3], inicialTexto: '0,1–0,3 mg/kg EV',
    acao: '—', pagina: 'p. 165 (Tabela 2); 0,3 mg/kg também na p. 164',
    notas: [],
    errata: 'O cap. 9 (p. 150) dá a dose analgésica como 0,1–0,5 mg/kg em infusão lenta; o cap. 10 (p. 165) dá 0,1–0,3 mg/kg. A tela mostra a do cap. 10.',
  },
  {
    id: 'fentanil', nome: 'Fentanil', unidade: 'µg', concentracoes: [50], apresentacao: '50 µg/1 mL ou 500 µg/10 mL (50 µg/mL)',
    inicialPorKg: [0.5, 1], inicialTexto: '0,5–1 µg/kg EV lento em 1–2 min (risco de tórax rígido se infusão rápida)',
    repiquePorKg: [0.5, 1], repiqueTexto: 'mesma dose, se necessário, a cada 2 min',
    acao: 'início 2–3 min; duração 30–60 min', pagina: 'p. 166 (Tabela 2)',
    notas: ['Opioide de escolha no paciente instável (p. 166).', 'Tórax rígido: antídoto (naloxona) ou bloqueador neuromuscular de ação curta seguido de intubação.'],
  },
  {
    id: 'morfina', nome: 'Morfina', unidade: 'mg', concentracoes: [1, 10], apresentacao: '1 mg/1 mL ou 10 mg/1 mL',
    inicialPorKg: [0.05, 0.1], inicialTexto: '0,05–0,1 mg/kg EV',
    repiquePorKg: [0.05, 0.1], repiqueTexto: 'pode ser repetida e titulada a cada 15 min conforme a resposta',
    teto: { valor: 4, texto: 'máximo de 4 mg em pacientes virgens de opioides', condicional: 'virgem-opioide' },
    acao: 'início 5–10 min; duração 3–5 h', pagina: 'p. 166 (Tabela 2)', notas: [],
  },
]

export type SapCalculada = {
  inicial: Faixa
  limitadoAoTeto: boolean
  /** volume da dose inicial para cada concentração da apresentação */
  inicialMl: { concentracao: number; ml: Faixa }[]
  repique: Faixa | null
}

/**
 * Dose inicial e repique para o peso. O teto do livro (midazolam 5 mg,
 * morfina 4 mg no virgem de opioide) limita a dose inicial calculada.
 */
export function calcularSap(d: DrogaSap, pesoKg: number, opcoes: { virgemOpioide?: boolean } = {}): SapCalculada | null {
  if (!valido(pesoKg)) return null
  let ini: Faixa = [d.inicialPorKg[0] * pesoKg, d.inicialPorKg[1] * pesoKg]
  let limitado = false
  const aplicaTeto = d.teto && (d.teto.condicional !== 'virgem-opioide' || opcoes.virgemOpioide !== false)
  if (d.teto && aplicaTeto && ini[1] > d.teto.valor) {
    limitado = true
    ini = [Math.min(ini[0], d.teto.valor), d.teto.valor]
  }
  return {
    inicial: ini,
    limitadoAoTeto: limitado,
    inicialMl: d.concentracoes.map((c) => ({ concentracao: c, ml: [ini[0] / c, ini[1] / c] as Faixa })),
    repique: d.repiquePorKg ? [d.repiquePorKg[0] * pesoKg, d.repiquePorKg[1] * pesoKg] : null,
  }
}

// ── Adjuvantes citados na Tabela 2 ───────────────────────────────────────────

export type AdjuvanteSap = { id: string; nome: string; porKg?: Faixa; fixo?: Faixa; unidade: 'mg' | 'µg'; texto: string; pagina: string }

export const ADJUVANTES_SAP: AdjuvanteSap[] = [
  { id: 'fentanil-teto', nome: 'Teto de fentanil com etomidato ou propofol', porKg: [0.5, 0.5], unidade: 'µg', texto: 'limitar o fentanil a 0,5 µg/kg para evitar depressão respiratória', pagina: 'p. 162 e 164' },
  { id: 'lidocaina', nome: 'Lidocaína antes de etomidato ou propofol', porKg: [0.5, 0.5], unidade: 'mg', texto: '0,5 mg/kg EV com torniquete por 30 a 120 s antes da droga (dor no sítio de infusão)', pagina: 'p. 162 e 164' },
  { id: 'lidocaina-diluida', nome: 'Lidocaína diluída no propofol', porKg: [0.5, 1], unidade: 'mg', texto: '0,5–1 mg/kg de lidocaína na dose inicial de propofol', pagina: 'p. 164' },
  { id: 'midazolam-premed', nome: 'Midazolam — pré-medicação da quetamina', porKg: [0.05, 0.05], unidade: 'mg', texto: '0,05 mg/kg antes da SAP com quetamina (reduz agitação de emersão; aumenta o tempo de recuperação)', pagina: 'p. 165' },
  { id: 'haloperidol-premed', nome: 'Haloperidol — pré-medicação da quetamina', fixo: [5, 5], unidade: 'mg', texto: '5 mg antes da SAP com quetamina', pagina: 'p. 165' },
  { id: 'midazolam-emersao', nome: 'Midazolam — agitação de emersão', porKg: [0.03, 0.03], unidade: 'mg', texto: '0,03 mg/kg', pagina: 'p. 165' },
  { id: 'midazolam-mioclonia', nome: 'Midazolam — mioclonia grave pelo etomidato', fixo: [1, 2], unidade: 'mg', texto: '1–2 mg IV a cada 1 min até ceder (com IOT, segundo o livro)', pagina: 'p. 162' },
]

export function calcularAdjuvante(a: AdjuvanteSap, pesoKg: number): Faixa | null {
  if (a.fixo) return [...a.fixo] as Faixa
  if (!valido(pesoKg) || !a.porKg) return null
  return [a.porKg[0] * pesoKg, a.porKg[1] * pesoKg]
}

// ── Reversores (p. 163 e 166) ────────────────────────────────────────────────

export const FLUMAZENIL = {
  doseMg: 0.2,
  texto: '0,2 mg EV em 30 s; pode repetir 0,2 mg a cada minuto até resposta (máximo de 1 mg). Como dura menos que os benzodiazepínicos, nova dose a cada 20 min, respeitando o máximo de 3 mg por hora.',
  maxCicloMg: 1,
  maxHoraMg: 3,
  pagina: 'p. 163',
}

/** Número de doses de 0,2 mg até o máximo do ciclo (1 mg): 5. */
export const dosesFlumazenilAteMaximo = () => Math.round(FLUMAZENIL.maxCicloMg / FLUMAZENIL.doseMg)

export const NALOXONA = {
  inicialMg: [0.4, 2] as Faixa,
  texto: 'dose inicial 0,4–2 mg, repetida a cada 2–3 min; início em 2 min, duração 30–120 min. Sem melhora após 10 mg, provavelmente o quadro não é só do opioide.',
  limiteMg: 10,
  pagina: 'p. 166',
}

// ── Avaliação (texto do livro) ───────────────────────────────────────────────

export const NIVEIS_SEDACAO = [
  { nivel: 'Analgesia', clinica: 'alívio de dor sem sedação intencional', via: 'via aérea pérvia e ventilação espontânea efetiva mantidas' },
  { nivel: 'Sedação mínima (ansiólise)', clinica: 'responde normalmente a comandos verbais; cognição e coordenação podem estar alteradas', via: 'via aérea pérvia e ventilação espontânea efetiva mantidas' },
  { nivel: 'Analgesia e sedação moderadas', clinica: 'olhos fechados, responde a comandos verbais (às vezes só com estímulo tátil)', via: 'via aérea pérvia e ventilação espontânea efetiva mantidas' },
  { nivel: 'Analgesia e sedação profundas', clinica: 'não desperta facilmente; responde a estímulo verbal vigoroso e/ou doloroso', via: 'pode precisar reposicionar a via aérea; FR pode ser baixa, ventilação espontânea efetiva' },
  { nivel: 'Dissociação', clinica: 'estado cataléptico (quetamina): olhos abertos, não obedece comandos', via: 'pode precisar reposicionar a via aérea; depressão respiratória transitória após bolus rápido' },
  { nivel: 'Anestesia geral', clinica: 'sem resposta a estímulo doloroso e sem reflexos de proteção', via: 'proteção da via aérea e ventilação comprometidas' },
]

export const ASA_SAP = [
  { classe: 'ASA I e II', texto: 'em geral toleram adequadamente a sedação procedural', pagina: 'p. 156' },
  { classe: 'ASA III ou mais', texto: 'maior risco de eventos adversos; preferir agentes com menor risco de hipotensão. Exemplos do livro: DM ou HAS mal controladas, DPOC, IMC > 40, hepatite em atividade, abuso/dependência de álcool, ICC, DRC dialítica, DAC com stents, doença cerebrovascular', pagina: 'p. 158–159' },
  { classe: 'ASA IV e V', texto: 'grande risco de evento adverso; o livro diz que a sedação procedural deve ser evitada', pagina: 'p. 159' },
]

export const JEJUM_SAP = { liquidosH: 2, solidosH: 6, texto: 'Em procedimento não emergencial: 2 horas para líquidos sem resíduos ou 6 horas para sólidos. Alimentação recente não é contraindicação à SAP na emergência (ACEP).', pagina: 'p. 159–160' }

export const ALTA_SAP = {
  observacaoMin: 30,
  criterios: [
    'Procedimento de baixo risco que dispense monitorização adicional',
    'Sintomas (dor, tontura, náuseas) controlados',
    'Sinais vitais e função cardiorrespiratória estáveis',
    'Condições mínimas de autocuidado sem assistência',
    'Nível de consciência pré-sedação restabelecido',
    'Responsável de confiança para supervisionar em casa por algumas horas',
    'Observação mínima de 30 minutos após a última dose de sedativo, sem intercorrências',
  ],
  pagina: 'p. 161',
}

export const RISCO_AUMENTADO_SAP = 'Idade acima de 65 anos ou menor de 2 anos, obesidade, gestação, conteúdo e tempo da última refeição, alteração do estado de consciência basal, intoxicações e, principalmente, condição clínica instável (p. 155).'

export const KETOFOL = {
  texto: '"Ketofol": diluição em partes iguais (1:1) ou proporção 4:1 de quetamina e propofol; a evidência atual não mostra diferença em relação ao propofol isolado em pacientes selecionados.',
  errata: 'O livro não traz dose do ketofol e não deixa claro a ordem da proporção 4:1 (quetamina:propofol ou o inverso). A ferramenta não calcula a mistura.',
  pagina: 'p. 164',
}
