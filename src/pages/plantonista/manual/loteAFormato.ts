// Formatação comum das telas do lote A (eletrólitos e acidobase).

export const br = (x: number | null | undefined, casas = 1) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')

export const faixaBr = (f: [number, number] | null | undefined, casas = 1) =>
  !f ? '—' : f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`

/** NumberField devolve 0 quando vazio: aqui 0 vira "não informado". */
export const informado = (x: number) => (x > 0 ? x : undefined)
