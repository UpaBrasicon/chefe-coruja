import type { Faixa } from '@/clinico/pediatria/fonteP2'

// Formatação das telas do lote P2 (fora do .tsx para o fast refresh).

export const num = (x: number, casas = 2) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
export const faixaTxt = (f: Faixa, casas = 2) => (f[0] === f[1] ? num(f[0], casas) : `${num(f[0], casas)}–${num(f[1], casas)}`)
export const pesoValido = (p: number) => Number.isFinite(p) && p > 0 && p <= 80
