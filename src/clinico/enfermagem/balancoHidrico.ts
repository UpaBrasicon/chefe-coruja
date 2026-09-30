// Balanço hídrico da enfermagem (porte do protótipo: "Sinais vitais e BH").
//
// O protótipo soma entradas e subtrai saídas de todos os lançamentos
// ("Saldo +200 mL"). Aqui a mesma conta, recortada no DIA DO BALANÇO: 24 h a
// partir da hora de início da unidade, divididas em períodos (o fechamento
// por plantão). Balanço = entradas − saídas; é a definição, não um corte
// clínico, e nada aqui diz se o valor é bom ou ruim.
//
// Fora, por falta de fonte escolhida: perdas insensíveis (a estimativa por
// peso e temperatura varia com a referência) e qualquer alerta de balanço
// positivo ou negativo. A hora de início (07:00) e o período (6 h) são
// CONVENÇÃO DA UNIDADE, não regra: a tela deixa trocar e o usuário confirma.
//
// Lançamento cancelado não soma (continua no histórico). O relógio é o de
// America/Sao_Paulo; a conta usa o fuso de verdade (Intl), não um -3 fixo.

export type TipoLancamento = 'entrada' | 'saida'
export type LancamentoBalanco = {
  tipo: TipoLancamento
  volume_ml: number
  /** ISO 8601 */
  aferido_em: string
  cancelado_em?: string | null
}

export type PeriodoBalanco = { inicio: Date; fim: Date; entradas: number; saidas: number; balanco: number; lancamentos: number }
export type BalancoDoDia = {
  inicio: Date
  fim: Date
  periodos: PeriodoBalanco[]
  entradas: number
  saidas: number
  balanco: number
  lancamentos: number
}

export const INICIO_PADRAO = 7
export const PERIODO_PADRAO = 6
const FUSO = 'America/Sao_Paulo'
const HORA_MS = 3_600_000

/** Arredonda para uma casa (mL com décimo, como o banco guarda). */
const r1 = (n: number) => Math.round(n * 10) / 10

/** Diferença, em ms, entre a hora de parede do fuso e UTC naquele instante. */
function deslocamento(instante: Date, fuso: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(instante)
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, Number(x.value)]),
  )
  const parede = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return parede - Math.floor(instante.getTime() / 1000) * 1000
}

/**
 * Início do dia do balanço que contém `agora`: a última vez em que o relógio
 * de São Paulo marcou `inicioHora`:00 (hoje, ou ontem se ainda não chegou).
 * `dias` desloca a janela (−1 = o dia anterior).
 */
export function inicioDoDia(agora: Date, inicioHora = INICIO_PADRAO, dias = 0, fuso = FUSO): Date {
  if (!Number.isInteger(inicioHora) || inicioHora < 0 || inicioHora > 23) throw new Error('Hora de início entre 0 e 23.')
  const off = deslocamento(agora, fuso)
  const parede = new Date(agora.getTime() + off)
  let alvo = Date.UTC(parede.getUTCFullYear(), parede.getUTCMonth(), parede.getUTCDate(), inicioHora)
  if (alvo > parede.getTime()) alvo -= 24 * HORA_MS
  alvo += dias * 24 * HORA_MS
  // volta para UTC com o deslocamento do próprio instante de início
  const aprox = alvo - off
  return new Date(alvo - deslocamento(new Date(aprox), fuso))
}

/** 'AAAA-MM-DDTHH:MM' lido no relógio de São Paulo → o instante (para o campo de hora do lançamento). */
export function instanteDaParede(texto: string, fuso = FUSO): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(texto)
  if (!m) throw new Error('Data e hora no formato AAAA-MM-DDTHH:MM.')
  const parede = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  const aprox = parede - deslocamento(new Date(parede), fuso)
  return new Date(parede - deslocamento(new Date(aprox), fuso))
}

/** Soma de entradas e saídas, sem cancelados. */
export function somar(lancamentos: readonly LancamentoBalanco[]): { entradas: number; saidas: number; balanco: number; lancamentos: number } {
  let entradas = 0
  let saidas = 0
  let n = 0
  for (const l of lancamentos) {
    if (l.cancelado_em) continue
    const v = Number(l.volume_ml)
    if (!Number.isFinite(v) || v <= 0) continue
    if (l.tipo === 'entrada') entradas += v
    else saidas += v
    n++
  }
  return { entradas: r1(entradas), saidas: r1(saidas), balanco: r1(entradas - saidas), lancamentos: n }
}

/**
 * O dia do balanço (24 h desde `inicioHora`) com os períodos de
 * `horasPeriodo` horas. O período precisa dividir as 24 h (1, 2, 3, 4, 6,
 * 8, 12 ou 24). Lançamento no instante de fim é do dia seguinte.
 */
export function balancoDoDia(
  lancamentos: readonly LancamentoBalanco[],
  opcoes: { agora: Date; inicioHora?: number; horasPeriodo?: number; dias?: number },
): BalancoDoDia {
  const horas = opcoes.horasPeriodo ?? PERIODO_PADRAO
  if (!Number.isInteger(horas) || horas <= 0 || 24 % horas !== 0) throw new Error('O período precisa dividir as 24 h.')
  const inicio = inicioDoDia(opcoes.agora, opcoes.inicioHora ?? INICIO_PADRAO, opcoes.dias ?? 0)
  const fim = new Date(inicio.getTime() + 24 * HORA_MS)
  const dentro = (l: LancamentoBalanco, a: Date, b: Date) => {
    const t = new Date(l.aferido_em).getTime()
    return t >= a.getTime() && t < b.getTime()
  }
  const periodos: PeriodoBalanco[] = []
  for (let i = 0; i < 24 / horas; i++) {
    const a = new Date(inicio.getTime() + i * horas * HORA_MS)
    const b = new Date(a.getTime() + horas * HORA_MS)
    periodos.push({ inicio: a, fim: b, ...somar(lancamentos.filter((l) => dentro(l, a, b))) })
  }
  return { inicio, fim, periodos, ...somar(lancamentos.filter((l) => dentro(l, inicio, fim))) }
}

/** "+200 mL", "−350,5 mL", "0 mL" (sinal de menos tipográfico). */
export function textoBalanco(ml: number): string {
  const v = r1(ml)
  const abs = Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${abs} mL`
}
