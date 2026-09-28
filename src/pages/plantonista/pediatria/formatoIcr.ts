// Formatação das telas do lote P3 (livro do ICr-HCFMUSP). Só apresentação.

export const br = (x: number | null | undefined, casas = 1) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')

export const faixaBr = (f: [number, number] | null | undefined, casas = 1) => {
  if (!f) return '—'
  const [a, b] = f
  return Math.abs(a - b) < 1e-9 ? br(a, casas) : `${br(a, casas)}–${br(b, casas)}`
}

/** Idade em anos (decimal) a partir de anos + meses. */
export const idadeAnos = (anos: number, meses: number) => (Number.isFinite(anos) ? anos : 0) + (Number.isFinite(meses) ? meses : 0) / 12

/** Pediatria vai até 13 anos, 11 meses e 29 dias (CLAUDE.md). */
export const idadePediatrica = (anos: number, meses: number) => idadeAnos(anos, meses) < 14

export type Paciente = { peso: number; anos: number; meses: number; rn: boolean }

export const PACIENTE_VAZIO: Paciente = { peso: 0, anos: 0, meses: 0, rn: false }

/** Verdadeiro quando dá para calcular dose/volume por peso (não RN, peso informado, idade pediátrica). */
export const podeCalcular = (p: Paciente) => !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)
