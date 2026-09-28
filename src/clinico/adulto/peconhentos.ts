import { fichaAdulto } from './fonte.ts'

// Acidentes por animais peçonhentos — cap. 101 do Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022), p. 1349–1359. A gravidade é escolhida
// por quem atende, pelas manifestações de cada tabela; a ferramenta devolve o
// número de ampolas que o livro traz para aquela gravidade e calcula a
// pré-medicação e a neostigmina por peso (ADR 0007). Os valores pediátricos do
// capítulo (neostigmina mg/kg e soro no escorpião moderado < 7 anos) não são
// implementados.

export const fichaPeconhentosAdulto = fichaAdulto(
  'adulto-animais-peconhentos',
  'Acidentes por animais peçonhentos — adulto',
  'cap. 101 Acidentes por animais peçonhentos, p. 1349–1359 (Tabelas 1–3)',
)

export type Faixa = [number, number]
export type Gravidade = 'leve' | 'moderado' | 'grave'
export type Via = 'EV' | 'IM'

const valido = (x: number) => Number.isFinite(x) && x > 0

export type ClasseAcidente = {
  gravidade: Gravidade
  manifestacoes: string
  /** null = o livro não indica soro nesta gravidade (no adulto) */
  ampolas: Faixa | null
  /** Loxosceles grave: 5 ampolas na forma cutânea e 10 na cutaneovisceral */
  ampolasAlternativa?: { rotulo: string; ampolas: Faixa }
}

export type Acidente = {
  id: string
  nome: string
  soro: string
  via: Via
  classes: ClasseAcidente[]
  pagina: string
  nota?: string
  errata?: string
}

export const ACIDENTES: Acidente[] = [
  { id: 'botropico', nome: 'Botrópico (jararaca)', soro: 'antibotrópico', via: 'EV', pagina: 'p. 1353–1354 (Tabela 1)',
    classes: [
      { gravidade: 'leve', manifestacoes: 'locais (edema, sangramento, eritema, dor) ausentes ou discretas; sem sistêmicas', ampolas: [2, 4] },
      { gravidade: 'moderado', manifestacoes: 'locais evidentes; sem sistêmicas', ampolas: [4, 8] },
      { gravidade: 'grave', manifestacoes: 'locais intensas (equimose, bolha, necrose) e sistêmicas (hemorragia, choque, anúria)', ampolas: [8, 12] },
    ],
    nota: 'Abscesso em 15% dos botrópicos; 1ª linha cloranfenicol, alternativas ceftriaxona, ciprofloxacina e gentamicina (p. 1350). Atenção a síndrome compartimental (p. 1352).' },
  { id: 'crotalico', nome: 'Crotálico (cascavel)', soro: 'anticrotálico', via: 'EV', pagina: 'p. 1354 (Tabela 2)',
    classes: [
      { gravidade: 'leve', manifestacoes: 'fácies miastênica/visão turva ausente ou tardia; mialgia ausente ou discreta; sem urina escura; sem oligúria', ampolas: [5, 5] },
      { gravidade: 'moderado', manifestacoes: 'fácies miastênica discreta a evidente; mialgia discreta; urina escura ausente ou pouco evidente; sem oligúria', ampolas: [10, 10] },
      { gravidade: 'grave', manifestacoes: 'fácies miastênica evidente; mialgia intensa; urina vermelha/marrom; oligúria/anúria pode estar presente', ampolas: [20, 20] },
    ] },
  { id: 'elapidico', nome: 'Elapídico (coral)', soro: 'antielapídico', via: 'EV', pagina: 'p. 1353',
    classes: [{ gravidade: 'grave', manifestacoes: 'todo acidente elapídico é considerado grave', ampolas: [5, 10] }],
    errata: 'O livro dá 5 a 10 ampolas. O inventário do projeto aponta divergência com o esquema do Ministério da Saúde; o capítulo não cita outra fonte para conferir. Mostra-se o valor impresso.' },
  { id: 'laquetico', nome: 'Laquético (surucucu)', soro: 'antilaquético', via: 'EV', pagina: 'p. 1353',
    classes: [{ gravidade: 'grave', manifestacoes: 'todo acidente laquético é grave; internação por pelo menos 72 h', ampolas: [12, 20] }],
    errata: 'O livro dá 12 a 20 ampolas. O inventário do projeto aponta divergência com o esquema do Ministério da Saúde; o capítulo não cita outra fonte para conferir. Mostra-se o valor impresso.' },
  { id: 'escorpionico', nome: 'Escorpiônico', soro: 'antiescorpiônico', via: 'EV', pagina: 'p. 1355–1356',
    classes: [
      { gravidade: 'leve', manifestacoes: 'apenas dor; observação de 4 a 6 horas', ampolas: null },
      { gravidade: 'moderado', manifestacoes: 'algumas manifestações sistêmicas leves; observação de 24 a 48 horas', ampolas: null },
      { gravidade: 'grave', manifestacoes: 'manifestações sistêmicas evidentes e intensas; internação e monitorização contínua', ampolas: [4, 6] },
    ],
    nota: 'No moderado o livro indica 2–3 ampolas só em crianças < 7 anos (valor pediátrico, não usado aqui). Com soro, monitorizar ao menos 24–48 h. Bloqueio com lidocaína ou bupivacaína para a dor.' },
  { id: 'phoneutria', nome: 'Phoneutria (armadeira)', soro: 'antiaracnídico', via: 'EV', pagina: 'p. 1357–1358 (Tabela 3)',
    classes: [
      { gravidade: 'leve', manifestacoes: 'dor local', ampolas: null },
      { gravidade: 'moderado', manifestacoes: 'dor local + sudorese/vômitos, agitação, HAS', ampolas: [2, 4] },
      { gravidade: 'grave', manifestacoes: 'dor local + sudorese profusa, vômitos intensos, priapismo, convulsões, coma, insuficiência cardíaca, bradicardia, choque, edema pulmonar', ampolas: [5, 10] },
    ] },
  { id: 'loxosceles', nome: 'Loxosceles (aranha-marrom)', soro: 'antiaracnídico', via: 'EV', pagina: 'p. 1357–1358 (Tabela 3)',
    classes: [
      { gravidade: 'leve', manifestacoes: 'sinais/sintomas locais incaracterísticos ou sugestivos; sem alteração laboratorial', ampolas: null },
      { gravidade: 'moderado', manifestacoes: 'lesão com rash ou < 3 cm; sem alteração laboratorial', ampolas: [5, 5] },
      { gravidade: 'grave', manifestacoes: 'lesão > 3 cm, evidência de hemólise', ampolas: [5, 5], ampolasAlternativa: { rotulo: 'forma cutaneovisceral', ampolas: [10, 10] } },
    ],
    nota: 'Antiveneno com melhor eficácia até 36 h da picada; prednisona 40 mg/dia por 7–10 dias e dapsona 50–100 mg/dia (p. 1357).' },
  { id: 'latrodectus', nome: 'Latrodectus (viúva-negra)', soro: 'antiaracnídico', via: 'IM', pagina: 'p. 1357–1359 (Tabela 3)',
    classes: [
      { gravidade: 'leve', manifestacoes: 'dor local, edema local discreto', ampolas: null },
      { gravidade: 'moderado', manifestacoes: 'dor em membros inferiores, parestesia, tremores e contraturas', ampolas: [1, 1] },
      { gravidade: 'grave', manifestacoes: 'sudorese generalizada, agitação, mialgia, dificuldade de deambular, cefaleia, hipertermia, taqui/bradicardia, HAS, dispneia, vômitos, priapismo, retenção urinária, fácies latrodectísmica', ampolas: [1, 2] },
    ],
    nota: 'Única exceção entre os antivenenos: via intramuscular; alívio em cerca de 3 h (p. 1357).',
    errata: 'Na p. 1359 a continuação da Tabela 3 repete o cabeçalho "Phoneutria" sobre a linha "Grave — 1 a 2 ampolas (IM)". Pela via IM e pela "fácies latrodectísmica", a linha é do Latrodectus e está atribuída a ele aqui.' },
]

export function soroPorGravidade(acidenteId: string, gravidade: Gravidade): { acidente: Acidente; classe: ClasseAcidente } | null {
  const acidente = ACIDENTES.find((a) => a.id === acidenteId)
  const classe = acidente?.classes.find((c) => c.gravidade === gravidade)
  return acidente && classe ? { acidente, classe } : null
}

export const SORO_ADMINISTRACAO = {
  texto: 'Soro antiofídico sempre EV (não aplicar SC perto da picada), em 10 a 30 minutos sob monitorização contínua, com adrenalina e material de intubação por perto.',
  pagina: 'p. 1353',
}

// ── Pré-medicação (p. 1350) ─────────────────────────────────────────────────

export type PreMedicacao = { id: string; nome: string; mgKg: number; maxMg: number }

export const PRE_MEDICACAO = {
  adrenalinaScMg: 0.25,
  adrenalinaTexto: 'adrenalina 0,25 mg SC no braço imediatamente antes do soro (estudo no Sri Lanka)',
  drogas: [
    { id: 'hidrocortisona', nome: 'Hidrocortisona', mgKg: 10, maxMg: 500 },
    { id: 'dexclorfeniramina', nome: 'Dextroclorfeniramina', mgKg: 0.08, maxMg: 5 },
    { id: 'ranitidina', nome: 'Ranitidina', mgKg: 2, maxMg: 100 },
  ] as PreMedicacao[],
  momento: '15 minutos antes da infusão do soro; evidência fraca para corticoide e bloqueadores H1/H2',
  pagina: 'p. 1350',
}

export function preMedicacao(d: PreMedicacao, pesoKg: number): { mg: number; limitadoAoTeto: boolean } | null {
  if (!valido(pesoKg)) return null
  const mg = d.mgKg * pesoKg
  return mg > d.maxMg ? { mg: d.maxMg, limitadoAoTeto: true } : { mg, limitadoAoTeto: false }
}

// ── Neostigmina no elapídico (p. 1352–1353) ─────────────────────────────────

export const NEOSTIGMINA = {
  mgMl: 0.5,
  adultoMg: [1, 2] as Faixa,
  repetirH: [2, 4] as Faixa,
  infusaoUgKgH: 12,
  texto: 'manifestações paralíticas graves e insuficiência respiratória: adulto 1–2 mg IV; na recorrência, repetir a mesma dose a cada 2–4 h (ou menos) ou infusão contínua iniciando a 12 µg/kg/h. Atropina sempre antes (dose não informada no capítulo)',
  pagina: 'p. 1352–1353',
  nota: 'A infusão de 12 µg/kg/h vem logo após a dose pediátrica, sem dizer se vale para o adulto; o capítulo não traz preparo, então o mL/h não é calculado.',
}

export function neostigmina(pesoKg: number) {
  const ml: Faixa = [NEOSTIGMINA.adultoMg[0] / NEOSTIGMINA.mgMl, NEOSTIGMINA.adultoMg[1] / NEOSTIGMINA.mgMl]
  const infusaoUgH = valido(pesoKg) ? NEOSTIGMINA.infusaoUgKgH * pesoKg : null
  return { bolusMg: NEOSTIGMINA.adultoMg, bolusMl: ml, infusaoUgH }
}

export const PEDIATRICO_CITADO = [
  'neostigmina 0,01–0,04 mg/kg IV em crianças (p. 1352)',
  'escorpião moderado: soro (2–3 ampolas) só em crianças < 7 anos (p. 1356)',
]
