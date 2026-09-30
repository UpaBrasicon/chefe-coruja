// Escore-z e percentil pelo método LMS (Cole), do jeito que a OMS calcula.
//
// Cada tabela da OMS traz, por mês de idade, três números: L (potência de
// Box-Cox, a assimetria), M (mediana) e S (coeficiente de variação). Para uma
// medida y na idade t:
//
//   z = ((y / M)^L − 1) / (L · S)          (L ≠ 0)
//   z = ln(y / M) / S                       (L = 0)
//
// e a medida de um escore-z é o inverso: y = M · (1 + L·S·z)^(1/L).
//
// Além de ±3, a OMS não usa a fórmula direto (a cauda da curva de Box-Cox
// estica demais nos indicadores de peso): mede a distância a partir da linha
// de ±3 em unidades da distância entre ±2 e ±3 ("escore-z restrito"). Com L = 1
// (comprimento/estatura e perímetro cefálico) as duas contas dão o mesmo número.
//
// Fontes:
//  • Cole TJ. The LMS method for constructing normalized growth standards.
//    Eur J Clin Nutr. 1990;44(1):45–60.
//  • Cole TJ, Green PJ. Smoothing reference centile curves: the LMS method and
//    penalized likelihood. Stat Med. 1992;11(10):1305–1319.
//  • WHO Multicentre Growth Reference Study Group. WHO Child Growth Standards:
//    length/height-for-age, weight-for-age, weight-for-length,
//    weight-for-height and body mass index-for-age — Methods and development.
//    Geneva: World Health Organization; 2006. Capítulo "Computation of
//    centiles and z-scores" (a regra do escore-z restrito além de ±3).
//
// Nada aqui interpreta: o número sai cru, a leitura é do profissional.

export type LinhaLms = [mes: number, L: number, M: number, S: number]
export type Lms = { L: number; M: number; S: number }

/** L tão perto de zero que a fórmula vira a do logaritmo. */
const L_ZERO = 1e-6

/** Medida no escore-z pedido (sem restrição): y = M(1 + LSz)^(1/L). */
export function medidaNoEscoreZ({ L, M, S }: Lms, z: number): number {
  if (Math.abs(L) < L_ZERO) return M * Math.exp(S * z)
  return M * Math.pow(1 + L * S * z, 1 / L)
}

/** Escore-z "cru" pela fórmula LMS, sem a restrição da OMS além de ±3. */
export function escoreZBruto({ L, M, S }: Lms, y: number): number {
  if (Math.abs(L) < L_ZERO) return Math.log(y / M) / S
  return (Math.pow(y / M, L) - 1) / (L * S)
}

/**
 * Escore-z como a OMS publica: igual ao cru entre −3 e +3; fora disso, a
 * distância além da linha de ±3 medida em "degraus" de (SD3 − SD2).
 */
export function escoreZ(lms: Lms, y: number): number {
  if (!(y > 0)) throw new RangeError('A medida precisa ser maior que zero.')
  const z = escoreZBruto(lms, y)
  if (z > 3) {
    const sd3 = medidaNoEscoreZ(lms, 3)
    const sd23 = sd3 - medidaNoEscoreZ(lms, 2)
    return 3 + (y - sd3) / sd23
  }
  if (z < -3) {
    const sd3 = medidaNoEscoreZ(lms, -3)
    const sd23 = medidaNoEscoreZ(lms, -2) - sd3
    return -3 + (y - sd3) / sd23
  }
  return z
}

/**
 * Função de distribuição da normal padrão, Φ(z) = erfc(−z/√2)/2, com a erfc
 * aproximada por Chebyshev (Press WH et al., Numerical Recipes, "erfcc": erro
 * relativo < 1,2e-7 em qualquer z). Sobra precisão para percentil com uma casa.
 */
export function normalAcumulada(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.5 * x)
  const erfc = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))))
  const cauda = erfc / 2
  return z >= 0 ? 1 - cauda : cauda
}

/** Percentil (0–100) do escore-z. */
export function percentil(z: number): number {
  return normalAcumulada(z) * 100
}

/**
 * L, M e S na idade em meses (fracionária), interpolando linear entre os dois
 * meses vizinhos da tabela. Fora da tabela devolve null — nada se extrapola.
 * (A OMS publica o padrão 0–5 anos também por dia; aqui a tabela é mensal e a
 * interpolação linear entre meses é a aproximação usada, como no protótipo.)
 */
export function lmsNaIdade(tabela: readonly LinhaLms[], meses: number): Lms | null {
  if (!Number.isFinite(meses) || tabela.length === 0) return null
  const primeiro = tabela[0][0]
  const ultimo = tabela[tabela.length - 1][0]
  if (meses < primeiro || meses > ultimo) return null
  let i = 0
  while (i < tabela.length - 1 && tabela[i + 1][0] <= meses) i++
  const a = tabela[i]
  const b = tabela[Math.min(i + 1, tabela.length - 1)]
  const t = b[0] === a[0] ? 0 : (meses - a[0]) / (b[0] - a[0])
  return { L: a[1] + (b[1] - a[1]) * t, M: a[2] + (b[2] - a[2]) * t, S: a[3] + (b[3] - a[3]) * t }
}
