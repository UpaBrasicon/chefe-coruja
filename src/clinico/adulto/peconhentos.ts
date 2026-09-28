import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Acidentes por animais peçonhentos — cap. 101 do Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022), p. 1349–1359. A gravidade é escolhida
// por quem atende, pelas manifestações de cada tabela; a ferramenta devolve o
// número de ampolas que o livro traz para aquela gravidade e calcula a
// pré-medicação e a neostigmina por peso (ADR 0007). Os valores pediátricos do
// capítulo (neostigmina mg/kg e soro no escorpião moderado < 7 anos) não são
// implementados.
//
// Versão .1 de 28/09/2026 (decisão do RT: PCDTs do MS de 2026 como fonte dos
// peçonhentos): PCDT dos Acidentes Escorpiônicos (lido) — 3 ampolas no
// moderado e 6 no grave, máximo 6, em qualquer idade; aranhas pelo portal do MS
// (Latrodectus sem soro). O PCDT dos Acidentes Ofídicos (Portaria SECTICS/MS
// nº 83, de 7/10/2025) existe e é citado, mas só o resumo pôde ser lido e ele
// não traz o número de ampolas: as serpentes ficam com o livro até o RT abrir
// o PCDT completo.

export const PCDT_ESCORPIAO_2026_ADULTO: Fonte = {
  citacao: 'Ministério da Saúde. Protocolo Clínico e Diretrizes Terapêuticas dos Acidentes Escorpiônicos. Brasília: MS/CONITEC; 2026. Quadro 3 (p. 9), p. 15–17 (Quadro 4).',
  url: 'https://www.gov.br/conitec/pt-br/midias/protocolos/2026/publicacao-ms/pcdt-acidentes-escorpionicos',
}

export const PCDT_OFIDICOS_2025: Fonte = {
  citacao: 'Ministério da Saúde. Protocolo Clínico e Diretrizes Terapêuticas dos Acidentes Ofídicos (Portaria SECTICS/MS nº 83, de 7 de outubro de 2025; publicado em julho de 2026). Versão resumida lida (5 p.): tipos de soro, velocidade de infusão 8–12 mL/min, não fracionar; número de ampolas por gravidade não consta do resumo.',
  url: 'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/animais-peconhentos/publicacoes/protocolo-clinico-e-diretrizes-terapeuticas-dos-acidentes-ofidicos',
}

export const MS_ARANHAS_ADULTO: Fonte = {
  citacao: 'Ministério da Saúde. Acidentes por aranhas — tratamento (portal Saúde de A a Z; tabela adaptada do Manual 2001 e do Ofício Circular nº 2/2014-CGDT/DEVIT/SVS/MS). Consultado em 28/09/2026.',
  url: 'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/animais-peconhentos/acidentes-por-aranhas/tratamento',
}

const PAG_PECONHENTOS = 'cap. 101 Acidentes por animais peçonhentos, p. 1349–1359 (Tabelas 1–3)'

export const fichaPeconhentosAdulto: Ficha = {
  ...fichaAdulto('adulto-animais-peconhentos', 'Acidentes por animais peçonhentos — adulto', PAG_PECONHENTOS),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_PECONHENTOS), PCDT_ESCORPIAO_2026_ADULTO, MS_ARANHAS_ADULTO, PCDT_OFIDICOS_2025],
  revisadoEm: '28/09/2026 (PCDT escorpiônicos 2026 e portal do MS conferidos; serpentes seguem o livro até o PCDT completo ser lido)',
}

/** O que o MS (PCDT 2026 e portal) escreve, ao lado do manual. */
export const MS_2026_PECONHENTOS: { tema: string; ms: string; livro: string; pagina: string }[] = [
  { tema: 'Escorpião moderado', ms: '3 frascos-ampolas de SAEsc (ou SAA), imediatamente, independentemente da idade', livro: 'sem soro no adulto; 2–3 ampolas só em < 7 anos (p. 1356)', pagina: 'PCDT 2026, Quadro 4, p. 17' },
  { tema: 'Escorpião grave', ms: '6 frascos-ampolas; não administrar mais de 6', livro: '4–6 ampolas (p. 1356)', pagina: 'PCDT 2026, Quadro 4, p. 17' },
  { tema: 'Escorpião: via e diluição', ms: 'IV diluído em SF 0,9% ou SG 5% (1:2 a 1:5, ou 1:1) em 10–15 min, ou bolus a 8–12 mL/min; intraóssea sem acesso venoso', livro: 'EV em 10–30 min sob monitorização (p. 1353)', pagina: 'PCDT 2026, p. 17' },
  { tema: 'Escorpião: observação', ms: 'sem clínica 4 h; leve 6–12 h; com soro no mínimo 24 h (grave em CTI); persistindo, reclassificar e complementar', livro: 'leve 4–6 h; moderado 24–48 h (p. 1355–1356)', pagina: 'PCDT 2026, Quadro 3, p. 9; p. 15' },
  { tema: 'Loxosceles', ms: 'cutânea leve: sem soro; cutânea moderada (< 3 cm): 5; cutânea grave (> 3 cm): 10; cutâneo-hemolítica: 10 (SALox ou SAAr)', livro: 'moderado 5; grave 5 (cutaneovisceral 10) (Tabela 3)', pagina: 'portal MS, tabela' },
  { tema: 'Phoneutria', ms: 'leve: sem soro; moderado 2–4; grave 5–10 (SAAr)', livro: 'igual (Tabela 3)', pagina: 'portal MS, tabela' },
  { tema: 'Latrodectus', ms: 'não há soro disponível: analgésicos, benzodiazepínicos, gluconato de cálcio e clorpromazina; internação ≥ 24 h', livro: 'soro antiaracnídico 1–2 ampolas IM (Tabela 3)', pagina: 'portal MS, tabela' },
  { tema: 'Serpentes', ms: 'PCDT de acidentes ofídicos (Portaria 83/2025): cinco soros (SABR, SABL, SABC, SAC, SAELA), infusão a 8–12 mL/min sem fracionar a dose; ampolas por gravidade só no PCDT completo, não lido', livro: 'Tabelas 1–2 (botrópico 2–4/4–8/8–12; crotálico 5/10/20; laquético 12–20; elapídico 5–10)', pagina: 'PCDT resumido, p. 2–3' },
]

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
