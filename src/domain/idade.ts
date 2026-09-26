// Idade e corte pediátrico — uma função só para o produto inteiro.
//
// Regra da unidade (CONTEXT.md, "Pediatria"): pediatria vai do nascimento
// (inclusive as primeiras 24 horas) até antes de completar 14 anos. Com 14
// anos completos é adulto, em toda regra que dependa de idade.
//
// O protótipo tinha três critérios convivendo (< 180 meses, `anos > 14` no
// PEWS, e 13a 11m 29d na triagem); um deles deixava quem tem 14 anos no modo
// pediátrico. Aqui só existe este.

export const IDADE_ADULTO_ANOS = 14

export type Idade = { anos: number; meses: number; dias: number; totalDias: number }

/** Data de calendário (sem hora) a partir de 'AAAA-MM-DD' ou Date. */
function comoData(d: string | Date): { a: number; m: number; d: number } {
  if (typeof d === 'string') {
    const [a, m, dia] = d.slice(0, 10).split('-').map(Number)
    return { a, m, d: dia }
  }
  return { a: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}

const diasNoMes = (a: number, m: number) => new Date(a, m, 0).getDate()

/**
 * Idade completa em anos, meses e dias entre o nascimento e `hoje`.
 * Devolve null se o nascimento é inválido ou está no futuro.
 */
export function idadeEm(nascimento: string | Date, hoje: string | Date): Idade | null {
  const n = comoData(nascimento)
  const h = comoData(hoje)
  if ([n.a, n.m, n.d, h.a, h.m, h.d].some((x) => !Number.isFinite(x))) return null
  const utcN = Date.UTC(n.a, n.m - 1, n.d)
  const utcH = Date.UTC(h.a, h.m - 1, h.d)
  if (utcH < utcN) return null

  // Meses completos; os dias contam a partir da âncora (nascimento + meses,
  // presa ao último dia do mês quando o dia não existe — 31/01 + 1 mês = 29/02).
  // Quem nasceu em 29/02 completa ano em 01/03 nos anos não bissextos.
  const totalMeses = (h.a - n.a) * 12 + (h.m - n.m) - (h.d < n.d ? 1 : 0)
  const mesAncora = n.m - 1 + totalMeses
  const anoAncora = n.a + Math.floor(mesAncora / 12)
  const mesAncora1 = (mesAncora % 12) + 1
  const diaAncora = Math.min(n.d, diasNoMes(anoAncora, mesAncora1))
  const dias = Math.round((utcH - Date.UTC(anoAncora, mesAncora1 - 1, diaAncora)) / 86_400_000)
  return {
    anos: Math.floor(totalMeses / 12),
    meses: totalMeses % 12,
    dias,
    totalDias: Math.round((utcH - utcN) / 86_400_000),
  }
}

/** Pediatria: do nascimento até antes de completar 14 anos. */
export function ehPediatrico(nascimento: string | Date, hoje: string | Date): boolean | null {
  const i = idadeEm(nascimento, hoje)
  if (!i) return null
  return i.anos < IDADE_ADULTO_ANOS
}

/** Rótulo curto: "Nd" até 30 dias, "Nm" até 23 meses, depois "Na". */
export function rotuloIdade(nascimento: string | Date, hoje: string | Date): string {
  const i = idadeEm(nascimento, hoje)
  if (!i) return '—'
  if (i.totalDias <= 30) return `${i.totalDias}d`
  const meses = i.anos * 12 + i.meses
  if (meses < 24) return `${meses}m`
  return `${i.anos}a`
}
