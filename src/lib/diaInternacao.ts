import { dataIso } from './formato.ts'

const meioDia = (instante: string) => Date.parse(`${dataIso(instante)}T12:00:00Z`)

/**
 * Dia da internação de uma aferição: D+1 é o dia da admissão; o dia vira à
 * meia-noite de Brasília, não 24 h depois da admissão (VD11, lote "Virada de
 * data"). Antes da admissão: "Adm".
 */
export function diaDaInternacao(aferidoEm: string, dataAdmissao: string): string {
  const d = Math.round((meioDia(aferidoEm) - meioDia(dataAdmissao)) / 86_400_000) + 1
  return d >= 1 ? `D+${d}` : 'Adm'
}
