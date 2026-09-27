import { fichaPediatrica } from './fonte.ts'

// Tubo endotraqueal pediátrico pela idade — fórmula do Anexo 2 do manual do
// HCFMUSP (p. 1494): (idade/4) + 4. O livro não traz equipamento por peso nem
// carga de desfibrilação pediátrica; essas partes ficaram de fora (casco).

export const fichaViaAereaPediatrica = fichaPediatrica('ped-via-aerea', 'Tubo endotraqueal pediátrico pela idade', 'Anexo 2, p. 1494')

export type Tubo = { calculadoMm: number; tuboMm: number }

/**
 * Diâmetro interno pela fórmula do livro, para idade em anos completos (1 a 13).
 * `tuboMm` é o valor arredondado ao meio milímetro, que é como os tubos vêm.
 */
export function tuboPorIdade(anos: number): Tubo | null {
  if (!Number.isFinite(anos) || anos < 1 || anos >= 14) return null
  const calculadoMm = anos / 4 + 4
  return { calculadoMm, tuboMm: Math.round(calculadoMm * 2) / 2 }
}
