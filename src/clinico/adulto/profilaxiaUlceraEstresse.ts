import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Profilaxia de úlcera de estresse (LAMG) e gastroproteção pelo Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022). O livro não tem capítulo
// próprio: a indicação com dose está no capítulo de sepse (p. 127), o
// capítulo de tétano cita a classe (p. 1255) e o de IAM sem supra traz a
// gastroproteção de quem usa dupla antiagregação (p. 208). A ferramenta
// mostra o critério do livro que está presente; a decisão é do médico
// (ADR 0007).
//
// Versão .1 de 28/09/2026: ensaio REVISE (NEJM 2024; resumo lido) e diretriz
// SCCM/ASHP 2024 (resumo lido) ao lado do manual.

export const REVISE_2024: Fonte = {
  citacao: 'Cook D, Deane A, Lauzier F, et al.; REVISE Investigators. Stress Ulcer Prophylaxis during Invasive Mechanical Ventilation. N Engl J Med. 2024;391(1):9–20 (resumo lido).',
  url: 'https://doi.org/10.1056/NEJMoa2404245',
}

export const SCCM_ASHP_2024: Fonte = {
  citacao: 'MacLaren R, Dionne JC, Granholm A, et al. Society of Critical Care Medicine and American Society of Health-System Pharmacists Guideline for the Prevention of Stress-Related Gastrointestinal Bleeding in Critically Ill Adults. Crit Care Med. 2024;52(8):e421–e430 (resumo lido).',
  url: 'https://doi.org/10.1097/CCM.0000000000006330',
}

const PAG_ULCERA = 'cap. 7 p. 127; cap. 13 p. 208; cap. 14 p. 219; cap. 93 p. 1255'

export const fichaProfilaxiaUlceraEstresse: Ficha = {
  ...fichaAdulto('adulto-profilaxia-ulcera-estresse', 'Profilaxia de úlcera de estresse e gastroproteção — adulto', PAG_ULCERA),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_ULCERA), REVISE_2024, SCCM_ASHP_2024],
  revisadoEm: '28/09/2026 (REVISE e SCCM/ASHP 2024 conferidos pelos resumos; manual mantido como base)',
}

export const REVISE = {
  droga: 'pantoprazol 40 mg IV 1 vez ao dia versus placebo, em adultos críticos sob ventilação invasiva (4.821 pacientes, 68 UTIs)',
  sangramentoPct: [1.0, 3.5] as [number, number],
  hr: 0.30,
  mortalidade90Pct: [29.1, 30.9] as [number, number],
  texto: 'Sangramento digestivo alto clinicamente importante 1,0% × 3,5% (HR 0,30; IC 95% 0,19–0,47); morte em 90 dias 29,1% × 30,9% (HR 0,94; sem diferença); pneumonia associada à ventilação e C. difficile sem diferença; sangramento importante para o paciente reduzido.',
}

export const SCCM_ASHP_ITENS: string[] = [
  'Fatores que provavelmente aumentam o risco de sangramento por estresse: coagulopatia, choque e doença hepática crônica; ventilação mecânica isolada não tem evidência firme como fator de risco.',
  'Nutrição enteral provavelmente reduz o risco.',
  'Todo adulto crítico com fator de risco deve receber inibidor de bomba de prótons ou antagonista H2, em regime de dose baixa (as duas classes são igualmente preferidas; IV ou VO).',
  'Suspender quando a doença crítica se resolve ou o fator de risco desaparece; suspender antes da transferência da UTI para evitar prescrição inadequada.',
  '9 recomendações condicionais e 4 declarações de boa prática (GRADE).',
]

export const DIFERENCAS_ULCERA_2024: string[] = [
  'O manual (cap. 7, p. 127) indica considerar profilaxia com VM > 48 h, coagulopatia ou choque; a SCCM/ASHP 2024 põe coagulopatia, choque e doença hepática crônica como fatores e diz que a VM isolada não tem evidência firme; o REVISE, por outro lado, mostrou menos sangramento com pantoprazol em todos os ventilados, sem efeito na mortalidade.',
  'Dose: o manual traz omeprazol 40 mg IV/dia; o REVISE usou pantoprazol 40 mg IV/dia; a SCCM/ASHP pede "dose baixa" de IBP ou anti-H2 (sem número no resumo).',
  'Suspensão: o manual não trata; a SCCM/ASHP manda suspender ao fim da doença crítica ou do fator de risco e antes da alta da UTI.',
]

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
