// Mapeamento de uma linha de tb_procedimento (SIGTAP) para a tabela
// terminologia.sigtap_procedimento. Usado pelo importador (upsert via API) e
// pelo gerador de SQL (gerar-sigtap-sql.ts), para os dois darem o mesmo
// resultado.
import type { LinhaPosicional } from './posicional.ts'
import { texto, inteiro, numero } from './tipos.ts'

/** SIGTAP usa 9999 para "sem limite" (idade). */
function idadeSigtap(v: string): number | null {
  const n = inteiro(v)
  if (n === null || n === 9999) return null
  return n
}

/** Os valores vêm em centavos, sem vírgula (VL_SA 000000001100 = R$ 11,00). */
export function valorSigtap(v: string): number | null {
  const n = numero(v)
  if (n === null || n === 0) return null
  return Math.round(n) / 100
}

/** Quantidade máxima de execução; 9999 é "sem limite". */
export function qtMaximaSigtap(v: string): number | null {
  const n = inteiro(v)
  if (n === null || n === 0 || n === 9999) return null
  return n
}

export function mapear(l: LinhaPosicional): Record<string, unknown> | null {
  const codigo = l.CO_PROCEDIMENTO
  if (!codigo) return null
  return {
    codigo: codigo.trim(),
    nome: texto(l.NO_PROCEDIMENTO) ?? '',
    complexidade: texto(l.TP_COMPLEXIDADE),
    sexo: texto(l.TP_SEXO),
    idade_min: idadeSigtap(l.VL_IDADE_MINIMA),
    idade_max: idadeSigtap(l.VL_IDADE_MAXIMA),
    valor_sa: valorSigtap(l.VL_SA),
    valor_sh: valorSigtap(l.VL_SH),
    valor_sp: valorSigtap(l.VL_SP),
    qt_maxima: qtMaximaSigtap(l.QT_MAXIMA_EXECUCAO),
    competencia: texto(l.DT_COMPETENCIA),
  }
}

