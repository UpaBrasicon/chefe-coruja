import { fichaAdulto } from './fonte.ts'

// Profilaxia de TEV pelo Manual de Medicina de Emergência do HCFMUSP (3ª ed.,
// 2022). O livro não tem capítulo de profilaxia nem escore de risco (não há
// Caprini nem Pádua): traz as doses em um ponto só (cap. 7, p. 127), a
// apresentação da HNF de profilaxia (cap. 25, p. 352), a reversão da HNF SC
// (cap. 79, p. 1044) e, espalhado pelos capítulos, onde a profilaxia é citada.
// A ferramenta reúne isso; a indicação é do médico (ADR 0007).

export const fichaProfilaxiaTev = fichaAdulto(
  'adulto-profilaxia-tev',
  'Profilaxia de TEV — doses pelo manual (adulto)',
  'cap. 7 p. 127; cap. 25 p. 352; cap. 79 p. 1044; menções em p. 298, 425, 493, 541, 545, 559, 604, 875 e 1255',
)

export type Faixa = [number, number]

export type DoseProfilaxia = {
  id: string
  nome: string
  dose: number
  unidade: 'mg' | 'UI'
  vezesDia: number
  via: string
  /** concentração da apresentação citada no livro (unidade por mL) */
  porMl?: number
  pagina: string
  errata?: string
}

export const DOSES_PROFILAXIA_TEV: DoseProfilaxia[] = [
  { id: 'enoxaparina', nome: 'Enoxaparina', dose: 40, unidade: 'mg', vezesDia: 1, via: 'SC', pagina: 'cap. 7, p. 127',
    errata: 'O livro imprime "Considear profilaxia de TEV"; lê-se "Considerar".' },
  { id: 'hnf', nome: 'Heparina não fracionada', dose: 5000, unidade: 'UI', vezesDia: 3, via: 'SC', porMl: 5000,
    pagina: 'cap. 7, p. 127; apresentação de profilaxia (1 mL = 5.000 U): cap. 25, p. 352' },
]

export const CONTEXTO_DAS_DOSES = 'As doses aparecem no capítulo de sepse, para "pacientes com disfunção orgânica" (p. 127). O livro não traz ajuste por função renal, por peso/obesidade nem outra droga para profilaxia.'

export function doseDiaria(d: DoseProfilaxia): number {
  return d.dose * d.vezesDia
}

/** Volume por dose na apresentação citada; null se o livro não dá concentração. */
export function volumeDoseMl(d: DoseProfilaxia): number | null {
  return d.porMl ? d.dose / d.porMl : null
}

export type MencaoProfilaxia = { contexto: string; texto: string; pagina: string; mecanica?: boolean }

export const MENCOES_PROFILAXIA_TEV: MencaoProfilaxia[] = [
  { contexto: 'Sepse com disfunção orgânica', texto: 'considerar profilaxia de TEV: enoxaparina 40 mg SC 1 vez/dia ou heparina 5.000 UI SC 3 vezes/dia', pagina: 'cap. 7, p. 127' },
  { contexto: 'Insuficiência cardíaca aguda', texto: '"profilaxia de trombose venosa profunda" listada no manejo', pagina: 'cap. 21, p. 298' },
  { contexto: 'Exacerbação de DPOC', texto: 'profilaxia de TEV durante a internação hospitalar, salvo contraindicação', pagina: 'cap. 31, p. 425' },
  { contexto: 'Derrame pleural parapneumônico', texto: 'sempre realizar profilaxia para TEV, salvo contraindicações', pagina: 'cap. 36, p. 493' },
  { contexto: 'AVC isquêmico com limitação da mobilidade', texto: 'de preferência compressão pneumática intermitente, se não houver contraindicações; não utilizar meias elásticas', pagina: 'cap. 38, p. 541', mecanica: true },
  { contexto: 'Hemorragia intraparenquimatosa', texto: 'compressão pneumática intermitente para prevenção de TEV', pagina: 'cap. 39, p. 545', mecanica: true },
  { contexto: 'Hemorragia subaracnóidea', texto: 'manter profilaxia de TEV com compressão pneumática', pagina: 'cap. 40, p. 559', mecanica: true },
  { contexto: 'Síndrome de Guillain-Barré', texto: 'profilaxia de trombose venosa profunda entre os cuidados de suporte', pagina: 'cap. 44, p. 604' },
  { contexto: 'Cetoacidose / estado hiperosmolar', texto: 'situações pró-trombóticas; profilaxia de TEV é indicada', pagina: 'cap. 64, p. 875 (Tabela 6)' },
  { contexto: 'Tétano', texto: 'HNF, HBPM ou outros anticoagulantes, administrados precocemente', pagina: 'cap. 93, p. 1255' },
]

// ── Reversão da HNF SC (cap. 79, Tabela 5, p. 1044) ─────────────────────────

export const PROTAMINA = {
  mgPor100UiSc: [1, 1.5] as Faixa,
  maxMg: 50,
  mgPorAmpola: 50,
  pagina: 'cap. 79, p. 1044 (Tabela 5, nota)',
}

/** Protamina para a HNF SC: 1–1,5 mg por 100 U, com teto de 50 mg. */
export function protaminaHnfSc(ui: number): { mg: Faixa; limitadoAoTeto: boolean; ampolas: Faixa } | null {
  if (!Number.isFinite(ui) || ui <= 0) return null
  const bruto: Faixa = [(ui / 100) * PROTAMINA.mgPor100UiSc[0], (ui / 100) * PROTAMINA.mgPor100UiSc[1]]
  const mg: Faixa = [Math.min(bruto[0], PROTAMINA.maxMg), Math.min(bruto[1], PROTAMINA.maxMg)]
  return { mg, limitadoAoTeto: bruto[1] > PROTAMINA.maxMg, ampolas: [mg[0] / PROTAMINA.mgPorAmpola, mg[1] / PROTAMINA.mgPorAmpola] }
}

export const FORA_DO_LIVRO = [
  'Escores de risco (Caprini, Pádua): não estão no livro.',
  'Ajuste da dose profilática por clearance de creatinina, por peso ou obesidade: não encontrado no livro.',
  'Fondaparinux em dose profilática, gestação/puerpério e cirurgia ortopédica: não encontrado no livro.',
  'Reversão da enoxaparina por protamina: não encontrada (a Tabela 5 da p. 1044 é por 100 unidades de heparina e não cita enoxaparina).',
]
