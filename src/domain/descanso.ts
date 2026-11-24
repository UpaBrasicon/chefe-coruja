// Divisão do descanso dos médicos (pedido 8; PS4 e PS5 do RT em 23/11/2026,
// docs/plantonista/PASSOMETRO-DIAGNOSTICO.md). A mesma conta do banco
// (private.blocos_descanso), aqui para a prévia antes de salvar: cada médico
// descansa (fim - início) x (N - mínimo acordado) / N minutos, enfileirados em
// N - mínimo faixas do tamanho da janela; quem cai na virada de uma faixa
// descansa no fim da janela e no começo dela.

export type BlocoDescanso = { perfil_id: string; nome?: string; inicio: number; fim: number }

export type MedicoDescanso = { perfil_id: string; nome: string }

const MIN = 60_000

/** Erro de regra (o mesmo texto do banco), ou null se dá para dividir. */
export function conferirDivisao(n: number, minimo: number, inicio: number, fim: number): string | null {
  if (n < 2) return 'Escolha pelo menos dois médicos para dividir o descanso.'
  if (!Number.isInteger(minimo) || minimo < 1 || minimo >= n) return 'O mínimo acordado vai de 1 até um a menos que o número de médicos.'
  if (!(fim > inicio) || fim - inicio > 14 * 60 * MIN) return 'A divisão termina depois de começar, em no máximo 14 horas.'
  return null
}

/** Os blocos da divisão igual. `inicio` e `fim` em milissegundos. */
export function blocosDescanso(inicio: number, fim: number, minimo: number, medicos: MedicoDescanso[]): BlocoDescanso[] {
  const n = medicos.length
  const t = Math.floor((fim - inicio) / MIN)
  const l = Math.floor((t * (n - minimo)) / n)
  const saida: BlocoDescanso[] = []
  let pos = 0
  for (const m of medicos) {
    const off = pos % t
    if (off + l <= t) {
      saida.push({ perfil_id: m.perfil_id, nome: m.nome, inicio: inicio + off * MIN, fim: inicio + (off + l) * MIN })
    } else {
      saida.push({ perfil_id: m.perfil_id, nome: m.nome, inicio: inicio + off * MIN, fim: inicio + t * MIN })
      saida.push({ perfil_id: m.perfil_id, nome: m.nome, inicio, fim: inicio + (off + l - t) * MIN })
    }
    pos += l
  }
  return saida
}

/** Minutos de descanso de cada um. */
export const minutosDeDescanso = (inicio: number, fim: number, minimo: number, n: number) =>
  Math.floor((Math.floor((fim - inicio) / MIN) * (n - minimo)) / n)

/** Quem descansa no instante `agora`. */
export function descansandoAgora(blocos: BlocoDescanso[], agora: number): Set<string> {
  return new Set(blocos.filter((b) => b.inicio <= agora && agora < b.fim).map((b) => b.perfil_id))
}

/**
 * Janela a partir das horas digitadas ("00:00" e "06:00"), no fuso do aparelho:
 * o início é o dia em que a janela ainda não acabou (hoje ou amanhã); o fim
 * vai para o dia seguinte quando a hora é menor ou igual à do início.
 */
export function janelaDasHoras(horaInicio: string, horaFim: string, agora: number): { inicio: number; fim: number } | null {
  const hm = (s: string) => {
    const m = /^(\d{2}):(\d{2})$/.exec(s)
    return m ? { h: Number(m[1]), m: Number(m[2]) } : null
  }
  const a = hm(horaInicio)
  const b = hm(horaFim)
  if (!a || !b || a.h > 23 || b.h > 23 || a.m > 59 || b.m > 59) return null
  const base = new Date(agora)
  const ini = new Date(base.getFullYear(), base.getMonth(), base.getDate(), a.h, a.m)
  const dur = ((b.h * 60 + b.m) - (a.h * 60 + a.m) + 1440) % 1440 || 1440
  let inicio = ini.getTime()
  // a janela de hoje já acabou: é a de amanhã; começa daqui a mais de 18 h: é a de ontem
  if (inicio + dur * MIN <= agora) inicio = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 1, a.h, a.m).getTime()
  else if (inicio - agora > 18 * 60 * MIN) inicio = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() - 1, a.h, a.m).getTime()
  const i = new Date(inicio)
  const fim = new Date(i.getFullYear(), i.getMonth(), i.getDate(), i.getHours(), i.getMinutes() + dur).getTime()
  return { inicio, fim }
}

/** Lê o jsonb de descanso_do_plantao. */
export type DivisaoDescanso = {
  id: string
  inicio: number
  fim: number
  minimo_acordados: number
  criada_por: string
  criada_em: string
  blocos: BlocoDescanso[]
  medicos: { perfil_id: string; nome: string; descansando: boolean }[]
}

export function lerDivisao(json: unknown): DivisaoDescanso | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  const ms = (v: unknown) => Date.parse(String(v ?? ''))
  const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [])
  const d: DivisaoDescanso = {
    id: String(o.id ?? ''),
    inicio: ms(o.inicio),
    fim: ms(o.fim),
    minimo_acordados: Number(o.minimo_acordados) || 1,
    criada_por: String(o.criada_por ?? ''),
    criada_em: String(o.criada_em ?? ''),
    blocos: arr(o.blocos).map((b) => ({ perfil_id: String(b.perfil_id ?? ''), nome: String(b.nome ?? ''), inicio: ms(b.inicio), fim: ms(b.fim) })),
    medicos: arr(o.medicos).map((m) => ({ perfil_id: String(m.perfil_id ?? ''), nome: String(m.nome ?? ''), descansando: m.descansando === true })),
  }
  return Number.isFinite(d.inicio) && Number.isFinite(d.fim) ? d : null
}
