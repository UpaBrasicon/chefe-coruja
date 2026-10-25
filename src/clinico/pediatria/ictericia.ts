import type { Ficha, Fonte } from '../ficha.ts'
import { EXSANGUINEO_COM_FATOR, EXSANGUINEO_SEM_FATOR, FOTO_COM_FATOR, FOTO_SEM_FATOR, type Serie } from './ictericiaLimiares.ts'

// Icterícia neonatal no RN com 35 semanas ou mais (lacunas da Central, lote 2,
// 25/10/2026; inclusão do neonato decidida pelo RT em 23/10/2026). Fonte: AAP 2022,
// lida no texto completo da revista; limiares hora a hora das Tabelas
// Suplementares 1 a 4 (ictericiaLimiares.ts). A indicação é do médico (ADR 0007).

export const AAP_2022_ICTERICIA: Fonte = {
  citacao: 'Kemper AR, Newman TB, Slaughter JL, et al. Clinical Practice Guideline Revision: Management of Hyperbilirubinemia in the Newborn Infant 35 or More Weeks of Gestation. Pediatrics. 2022;150(3):e2022058859 (PMID 35927462): Tabela 2 (fatores de risco de neurotoxicidade); KAS 6, 10, 15 e 17; Tabelas Suplementares 1–4 (limiares de fototerapia e de exsanguineotransfusão).',
  url: 'https://doi.org/10.1542/peds.2022-058859',
  pediatrica: true,
}

export const fichaIctericiaNeonatal: Ficha = {
  id: 'ped-ictericia-neonatal',
  titulo: 'Icterícia neonatal ≥ 35 semanas — fototerapia e escalonamento (AAP 2022)',
  versao: '2026-10-25.1',
  publico: 'pediatrico',
  fontes: [AAP_2022_ICTERICIA],
  revisadoEm: '25/10/2026 (lacunas da Central, lote 2; limiares extraídos das Tabelas Suplementares e conferidos na imagem)',
}

/** Fatores de risco de neurotoxicidade (Tabela 2), além da idade gestacional abaixo de 38 semanas. */
export const FATORES_NEUROTOXICIDADE = [
  'Albumina < 3,0 g/dL',
  'Doença hemolítica isoimune (Coombs direto positivo), deficiência de G6PD ou outra hemólise',
  'Sepse',
  'Instabilidade clínica significativa nas últimas 24 h',
]

export const ULTIMA_HORA = 14 * 24 - 1

/** Valor da série na hora; depois do fim da série, constante (nota de rodapé), salvo após 335 h. */
export function valorNaHora(s: Serie, hora: number): number | null {
  if (!Number.isInteger(hora) || hora < 1 || hora > ULTIMA_HORA) return null
  return hora < s.length ? s[hora] : s[s.length - 1]
}

const chave = (ig: number, comFator: boolean, foto: boolean): number => {
  if (foto && !comFator) return Math.min(ig, 40)
  return Math.min(ig, 38)
}

export type EntradaIctericia = {
  igSemanas: number
  horasDeVida: number
  /** algum fator de risco de neurotoxicidade da Tabela 2 além da IG */
  fatorRisco: boolean
  /** bilirrubina total subindo apesar da fototerapia (vai para a Tabela Suplementar 4) */
  subindoNaFoto?: boolean
  bilirrubina?: number
}

export type Limiares = {
  fototerapia: number
  exsanguineo: number
  escalonamento: number
  tabelaFoto: 1 | 2
  tabelaExs: 3 | 4
}

/** Limiares da AAP 2022 para a IG e a hora de vida. null fora de 35 semanas ou de 1–335 h. */
export function limiaresIctericia(e: EntradaIctericia): Limiares | null {
  if (!Number.isFinite(e.igSemanas) || e.igSemanas < 35) return null
  const ig = Math.floor(e.igSemanas)
  const foto = e.fatorRisco ? FOTO_COM_FATOR[chave(ig, true, true)] : FOTO_SEM_FATOR[chave(ig, false, true)]
  const usaT4 = e.fatorRisco || e.subindoNaFoto === true
  const exs = usaT4 ? EXSANGUINEO_COM_FATOR[chave(ig, true, false)] : EXSANGUINEO_SEM_FATOR[chave(ig, false, false)]
  const f = valorNaHora(foto, e.horasDeVida)
  const x = valorNaHora(exs, e.horasDeVida)
  if (f === null || x === null) return null
  return { fototerapia: f, exsanguineo: x, escalonamento: Math.round((x - 2) * 10) / 10, tabelaFoto: e.fatorRisco ? 2 : 1, tabelaExs: usaT4 ? 4 : 3 }
}

export type Faixa = 'abaixo' | 'fototerapia' | 'escalonamento' | 'exsanguineo'

/** Onde a bilirrubina total cai em relação aos limiares (KAS 10 e 17). */
export function faixaBilirrubina(bt: number, l: Limiares): Faixa | null {
  if (!Number.isFinite(bt) || bt <= 0) return null
  if (bt >= l.exsanguineo) return 'exsanguineo'
  if (bt >= l.escalonamento) return 'escalonamento'
  if (bt >= l.fototerapia) return 'fototerapia'
  return 'abaixo'
}

/** KAS 6: dosar bilirrubina sérica se a transcutânea estiver a até 3 mg/dL do limiar ou for ≥ 15 mg/dL. */
export function pedirSerica(transcutanea: number, limiarFoto: number): boolean {
  return Number.isFinite(transcutanea) && transcutanea > 0 && (transcutanea >= 15 || transcutanea >= limiarFoto - 3)
}

/** KAS 15: suspender a fototerapia é opção quando a bilirrubina cai pelo menos 2 mg/dL abaixo do limiar da hora em que começou. */
export const suspensaoFototerapia = (limiarNoInicio: number) => Math.round((limiarNoInicio - 2) * 10) / 10
