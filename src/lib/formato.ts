// Datas, horas e números na tela (guia do padrão do frontend, 4.4): sempre no
// fuso de Brasília e com vírgula decimal. É o único arquivo que formata com
// toLocale*/Intl; a verificação da CI conta o que formata fora daqui.

const FUSO = 'America/Sao_Paulo'

const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })
const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' })
const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Instante = string | number | Date

const comoData = (v: Instante) => (v instanceof Date ? v : new Date(v))

/** "19:43" */
export const hora = (v: Instante) => fmtHora.format(comoData(v))

/** "19/10/2026" de um instante (no fuso de Brasília). */
export const data = (v: Instante) => fmtData.format(comoData(v))

/** "19/10/2026" de uma data pura (YYYY-MM-DD), sem deslocar o dia pelo fuso. */
export const dataPura = (d: string) => fmtData.format(new Date(d + 'T12:00:00Z'))

/** "19/10/2026, 19:43" */
export const dataHora = (v: Instante) => fmtDataHora.format(comoData(v))

/** "há 12 min", "há 1h05", "há 3 d" — do instante até agora. */
export function tempoDecorrido(desde: Instante, agora: Instante = Date.now()) {
  const min = Math.max(0, Math.floor((comoData(agora).getTime() - comoData(desde).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  if (min < 24 * 60) return `há ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
  return `há ${Math.floor(min / (24 * 60))} d`
}

/** "R$ 1.234,56" */
export const moeda = (n: number) => fmtMoeda.format(n)

/** "1.234,5" — casas decimais fixas quando informadas. */
export function numero(n: number, casas?: number) {
  return new Intl.NumberFormat('pt-BR', casas === undefined ? {} : { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n)
}

const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' })
const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit' })
const fmtSemanaCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short' })
const fmtPorExtenso = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long' })

/** "19/10" */
export const diaMes = (v: Instante) => fmtDiaMes.format(comoData(v))

/** "19" */
export const dia = (v: Instante) => fmtDia.format(comoData(v))

/** "seg" (sem o ponto) */
export const semanaCurta = (v: Instante) => fmtSemanaCurta.format(comoData(v)).replace('.', '')

/** "Segunda-feira, 19 de outubro" */
export function dataPorExtenso(v: Instante) {
  const t = fmtPorExtenso.format(comoData(v))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const fmtIso = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "2026-10-19": a data em Brasília no formato do campo date e do banco. */
export const dataIso = (v: Instante = Date.now()) => fmtIso.format(comoData(v))

const fmtDiaMesHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmtInput = new Intl.DateTimeFormat('sv-SE', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

/** "19/10, 19:43" */
export const diaMesHora = (v: Instante) => fmtDiaMesHora.format(comoData(v))

/** "2026-10-19T19:43": valor de <input type="datetime-local"> no fuso de Brasília. */
export const dataHoraInput = (v: Instante = Date.now()) => fmtInput.format(comoData(v)).replace(' ', 'T')

/** "1.234,5": até `maxCasas` decimais (sem completar com zeros). */
export const numeroAte = (n: number, maxCasas: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: maxCasas }).format(n)
