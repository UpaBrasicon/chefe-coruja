// Minha agenda, aba Minha escala (revisão de tela do RT, 24/11/2026, M2):
// plantões encostados um no outro viram um bloco; bloco com mais de 24 h
// seguidas ganha o sinal de alerta no calendário. Só aviso na tela: a regra de
// descanso da escala continua a do banco.
// node --experimental-strip-types --test src/lib/escalaSeguida.test.ts

export const LIMITE_HORAS_SEGUIDAS = 24

export type PlantaoNoTempo = { id: string; data: string; inicio: string; duracao_min: number }

export type BlocoSeguido = { inicio: number; fim: number; horas: number; ids: string[]; datas: string[] }

/** Junta plantões encostados (o próximo começa até o fim do anterior). */
export function blocosSeguidos(plantoes: readonly PlantaoNoTempo[]): BlocoSeguido[] {
  const ordenados = plantoes
    .map((p) => ({ p, ini: Date.parse(p.inicio) }))
    .filter((x) => Number.isFinite(x.ini))
    .sort((a, b) => a.ini - b.ini)
  const blocos: BlocoSeguido[] = []
  for (const { p, ini } of ordenados) {
    const fim = ini + Math.max(0, p.duracao_min) * 60_000
    const ultimo = blocos[blocos.length - 1]
    if (ultimo && ini <= ultimo.fim) {
      ultimo.fim = Math.max(ultimo.fim, fim)
      ultimo.ids.push(p.id)
      if (!ultimo.datas.includes(p.data)) ultimo.datas.push(p.data)
    } else {
      blocos.push({ inicio: ini, fim, horas: 0, ids: [p.id], datas: [p.data] })
    }
  }
  for (const b of blocos) b.horas = Math.round((b.fim - b.inicio) / 3_600_000)
  return blocos
}

/** Blocos que passam do limite (mais de 24 h seguidas). */
export function blocosAcimaDoLimite(plantoes: readonly PlantaoNoTempo[], limiteHoras = LIMITE_HORAS_SEGUIDAS): BlocoSeguido[] {
  return blocosSeguidos(plantoes).filter((b) => b.fim - b.inicio > limiteHoras * 3_600_000)
}
