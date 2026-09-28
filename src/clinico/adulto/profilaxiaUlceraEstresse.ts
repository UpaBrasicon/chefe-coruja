import { fichaAdulto } from './fonte.ts'

// Profilaxia de úlcera de estresse (LAMG) e gastroproteção pelo Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022). O livro não tem capítulo
// próprio: a indicação com dose está no capítulo de sepse (p. 127), o
// capítulo de tétano cita a classe (p. 1255) e o de IAM sem supra traz a
// gastroproteção de quem usa dupla antiagregação (p. 208). A ferramenta
// mostra o critério do livro que está presente; a decisão é do médico
// (ADR 0007).

export const fichaProfilaxiaUlceraEstresse = fichaAdulto(
  'adulto-profilaxia-ulcera-estresse',
  'Profilaxia de úlcera de estresse e gastroproteção — adulto',
  'cap. 7 p. 127; cap. 13 p. 208; cap. 14 p. 219; cap. 93 p. 1255',
)

export type Referencia = { contexto: string; texto: string; droga?: string; pagina: string; nota?: string }

export const ULCERA_ESTRESSE: Referencia[] = [
  { contexto: 'Sepse / choque séptico', texto: 'considerar profilaxia de úlcera de estresse em pacientes em ventilação mecânica por mais de 48 horas, com coagulopatia ou choque',
    droga: 'omeprazol 40 mg EV 1 vez/dia', pagina: 'cap. 7, p. 127',
    nota: 'O texto não deixa claro se VM > 48 h, coagulopatia e choque são critérios alternativos ou se coagulopatia/choque se somam à VM; a ferramenta não decide por ele.' },
  { contexto: 'Tétano', texto: 'profilaxia de úlcera de estresse pode ser prescrita em pacientes em ventilação mecânica',
    droga: 'bloqueadores H2 ou inibidores da bomba de prótons (sem dose no capítulo)', pagina: 'cap. 93, p. 1255' },
]

export const OMEPRAZOL_ULCERA = { mg: 40, via: 'EV', vezesDia: 1, pagina: 'cap. 7, p. 127' }

export const NOTA_AVC_ULCERA = 'No cap. 38 (AVC isquêmico, p. 541) "prevenção de úlceras de estresse" descreve mudança de decúbito, higiene de pele e colchões adequados, isto é, lesão de pele por pressão — não é profilaxia gástrica.'

// ── Gastroproteção na dupla antiagregação (cap. 13, p. 208) ─────────────────

export const IBP_DUPLA_ANTIAGREGACAO = {
  droga: 'pantoprazol 40 mg VO 1 x/dia (citado como exemplo de IBP)',
  texto: 'indicado em pacientes em uso de dupla antiagregação plaquetária e risco de sangramento digestivo',
  pagina: 'cap. 13, p. 208',
}

/** Cada um isoladamente é critério (p. 208). */
export const CRITERIOS_ISOLADOS = [
  { id: 'ulcera', rotulo: 'História de úlcera gástrica' },
  { id: 'sangramento', rotulo: 'Sangramento do trato gastrointestinal' },
  { id: 'anticoagulante', rotulo: 'Uso de anticoagulantes' },
  { id: 'aine', rotulo: 'Uso crônico de anti-inflamatórios não esteroidais' },
  { id: 'corticoide', rotulo: 'Uso de corticosteroide' },
] as const

/** "Dois dos seguintes" (p. 208). */
export const CRITERIOS_PAREADOS = [
  { id: 'idade65', rotulo: 'Idade > 65 anos' },
  { id: 'dispepsia', rotulo: 'Dispepsia' },
  { id: 'drge', rotulo: 'Doença do refluxo gastroesofágico' },
  { id: 'hpylori', rotulo: 'Infecção por Helicobacter pylori' },
] as const

export const ERRATA_ALCOOL = 'A p. 208 escreve "Dois dos seguintes: > 65 anos, dispepsia, doença do refluxo gastroesofágico, infecção por Helicobacter pylori; ou uso de álcool". Não fica claro se o álcool conta sozinho ou entra como um dos dois; a ferramenta mostra o álcool à parte e não o soma.'

export type CriteriosIbp = {
  duplaAntiagregacao: boolean
  isolados: string[]
  pareados: string[]
  alcool: boolean
}

export type ResultadoIbp = {
  /** algum critério do livro presente (isolado, ou dois dos pareados) */
  criterioPresente: boolean
  motivos: string[]
  /** álcool marcado: leitura ambígua no livro */
  alcoolAmbiguo: boolean
  semDuplaAntiagregacao: boolean
}

export function avaliarIbpDupla(c: CriteriosIbp): ResultadoIbp {
  const isolados = CRITERIOS_ISOLADOS.filter((x) => c.isolados.includes(x.id)).map((x) => x.rotulo)
  const pareados = CRITERIOS_PAREADOS.filter((x) => c.pareados.includes(x.id)).map((x) => x.rotulo)
  const motivos: string[] = [...isolados]
  if (pareados.length >= 2) motivos.push(`dois ou mais de: ${pareados.join(', ')}`)
  return {
    criterioPresente: c.duplaAntiagregacao && motivos.length > 0,
    motivos: c.duplaAntiagregacao ? motivos : [],
    alcoolAmbiguo: c.duplaAntiagregacao && c.alcool,
    semDuplaAntiagregacao: !c.duplaAntiagregacao,
  }
}

export const NOTA_IAM_SUPRA = 'No IAM com supra (cap. 14, p. 219) a lista de medidas iniciais traz "Pantoprazol 20 mg VO", sem critério — dose diferente dos 40 mg da p. 208.'

export const FORA_DO_LIVRO_ULCERA = [
  'Lista ampla de fatores de risco (queimados, TCE, politrauma, transplante, cirurgia longa etc.): não encontrada no livro.',
  'Critérios de suspensão da profilaxia e papel da dieta enteral: não encontrados no livro.',
  'Dose de pantoprazol EV para úlcera de estresse: não encontrada (o livro dá omeprazol 40 mg EV).',
]
