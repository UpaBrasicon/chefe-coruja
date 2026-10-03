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

// ── Faixa etária para as regras de tela ─────────────────────────────────────
// Decisão do RT (02/10/2026): sem data de nascimento (ou com data inválida) o
// paciente NÃO é tratado como adulto. As regras abaixo dizem, para cada uso,
// o que vale quando a idade é desconhecida — sempre o lado que não oferece
// nada de adulto (dose, escore, protocolo) a quem pode ser criança.

export type FaixaEtaria = 'pediatrico' | 'adulto' | 'desconhecida'

/** Faixa pela IDADE (nunca pela porta). Sem nascimento ou inválido: 'desconhecida'. */
export function faixaEtaria(nascimento: string | Date | null | undefined, hoje: string | Date): FaixaEtaria {
  if (!nascimento) return 'desconhecida'
  const p = ehPediatrico(nascimento, hoje)
  return p === null ? 'desconhecida' : p ? 'pediatrico' : 'adulto'
}

/**
 * Conteúdo de adulto (receita padrão e favoritos com dose de adulto, NEWS2,
 * qSOFA, protocolo de adulto) só para quem é adulto PELA IDADE.
 */
export const ofereceConteudoAdulto = (f: FaixaEtaria) => f === 'adulto'

/**
 * Lado pediátrico que não oferece risco a mais quando a idade é desconhecida:
 * prescrição pelo peso aferido (o campo de peso aparece) e PA opcional nos
 * vitais (ver publicoDosVitais). Escores que dependem da idade (PEWS,
 * Phoenix, NEWS2) não rodam sem ela; a tela diz o motivo.
 */
export const aplicaCuidadoPediatrico = (f: FaixaEtaria) => f !== 'adulto'

/**
 * Públicos de protocolo da observação que podem ser oferecidos. Sem idade,
 * só os de público "todos": nem o de adulto (pode ser criança) nem o
 * pediátrico (o critério do protocolo depende da idade).
 */
export function publicosDeProtocolo(f: FaixaEtaria): string[] {
  if (f === 'pediatrico') return ['todos', 'pediatrico']
  if (f === 'adulto') return ['todos', 'adulto']
  return ['todos']
}

/** Rótulo curto da faixa para listas ("pediatria", "sem data de nascimento"); adulto não leva rótulo. */
export function rotuloFaixa(f: FaixaEtaria): string {
  return f === 'pediatrico' ? 'pediatria' : f === 'desconhecida' ? 'sem data de nascimento' : ''
}
