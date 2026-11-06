// Exportações da escala e da auditoria de transferências, agora pela `csv.ts`
// (achado guardado de 07/10/2026, feito em 05/11/2026): campo com ";" ou quebra
// de linha vai entre aspas e texto que começa com = + - @ não vira fórmula.
import { gerarCsv } from './csv.ts'

export type LinhaEscalaCsv = { setor: string; data: string; turno: string; plantonista: string | null; quinzenal: boolean }
export type LinhaTransferenciaCsv = { paciente: string | null; data: string; motivo: string | null }

export function csvEscala(unidade: string, mes: string, linhas: LinhaEscalaCsv[]) {
  return gerarCsv(
    ['Setor', 'Data', 'Turno', 'Plantonista', 'Quinzenal'],
    linhas.map((l) => [l.setor, l.data, l.turno, l.plantonista, l.quinzenal]),
    { contexto: [['Unidade', unidade], ['Mês', mes]] },
  )
}

export function csvTransferencias(unidade: string, geradoEm: string, linhas: LinhaTransferenciaCsv[]) {
  return gerarCsv(
    ['Paciente', 'Data', 'Motivo'],
    linhas.map((l) => [l.paciente, l.data, l.motivo]),
    { contexto: [['Unidade', unidade], ['Gerado em', geradoEm]] },
  )
}
