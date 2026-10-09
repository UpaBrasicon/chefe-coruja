// Aprazamento assistido (Fase 2, tarefa 2): formatos das RPCs e as contas da
// grade, iguais às do banco (migration 20261031000002).

export type Grade = {
  inicio: string; configurada: boolean; atualizado_em: string | null
  grades: Record<string, { horarios: string[]; origem: string }>
}

export type Sugestao = { intervalo_h: number; horarios: string[]; origem: string; primeira: string | null; prescrito_as: string }
export type UltimoAprazamento = {
  horarios: string[]; sugeridos: string[] | null; ajustado: boolean; motivo: string | null; por: string | null; em: string
}
export type SugestaoItem = { item_id: string; sugestao: Sugestao | null; ultimo: UltimoAprazamento | null }

/** Intervalos com grade na tela de configuração (1/1h fica com a regra do início). */
export const INTERVALOS_GRADE = [2, 3, 4, 6, 8, 12, 24] as const

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

/** "8, 16:00 0:30" → ["00:30", "08:00", "16:00"]; o que não é hora fica em `invalidos`. */
export function lerHorarios(texto: string): { horarios: string[]; invalidos: string[] } {
  const partes = texto.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean)
  const horarios = new Set<string>()
  const invalidos: string[] = []
  for (const p of partes) {
    const m = /^(\d{1,2})(?:[:h](\d{2}))?h?$/.exec(p)
    const h = m ? `${m[1].padStart(2, '0')}:${m[2] ?? '00'}` : p
    if (HORA.test(h)) horarios.add(h)
    else invalidos.push(p)
  }
  return { horarios: [...horarios].sort(), invalidos }
}

/** Mesma conta do banco: início + k × intervalo, em ordem. */
export function horariosPorIntervalo(inicio: string, intervalo: number): string[] {
  const [h, m] = inicio.split(':').map(Number)
  const base = h * 60 + m
  return Array.from({ length: 24 / intervalo }, (_, k) => {
    const t = (base + k * intervalo * 60) % 1440
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }).sort()
}

export function mesmaLista(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const x = [...(a ?? [])].sort()
  const y = [...(b ?? [])].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}
