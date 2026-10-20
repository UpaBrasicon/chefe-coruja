import { cn } from '@/lib/utils'
import { numero } from '@/lib/formato'

// Formatação das telas do lote E7 (manual do HCFMUSP, adulto).

export type Faixa = [number, number]

export const br = (x: number, casas = 1) => numero(Math.round(x * 10 ** casas) / 10 ** casas)
export const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

export const botao = (ativo: boolean) =>
  cn('rounded-controle border px-2.5 py-1.5 text-left text-apoio transition-colors', ativo ? 'border-acao bg-acao/5 ring-1 ring-acao' : 'hover:bg-trilha/50')

/** Converte o texto digitado em número (vírgula ou ponto); NaN se vazio. */
export const lerNumero = (v: string) => (v.trim() === '' ? Number.NaN : Number(v.replace(',', '.')))
