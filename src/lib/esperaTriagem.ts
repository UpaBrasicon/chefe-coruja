// Indicador chegada → triagem (Fase 1, tarefa 3): o formato devolvido por
// indicador_espera_triagem(), o período escolhido e os minutos por extenso.

export type Periodo = 'hoje' | '7d' | '30d' | 'intervalo'

export type EsperaTriagem = {
  de: string; ate: string; alvo_min: number
  chegadas: number; triados: number; sem_triagem: number
  media_min: number | null; mediana_min: number | null; p90_min: number | null; fora_alvo: number
  chamada: { chamados: number; media_min: number | null; mediana_min: number | null }
  por_dia: { dia: string; chegadas: number; triados: number; media_min: number | null; mediana_min: number | null; fora_alvo: number; chamada_mediana_min: number | null }[]
}

/** Dia (AAAA-MM-DD) menos n dias, sem fuso: conta no calendário. */
export function diasAntes(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d - n))
  return t.toISOString().slice(0, 10)
}

/** "7 dias" = hoje e os 6 anteriores. */
export function periodoDe(p: Periodo, hoje: string, de: string, ate: string): { de: string; ate: string } {
  if (p === 'hoje') return { de: hoje, ate: hoje }
  if (p === '7d') return { de: diasAntes(hoje, 6), ate: hoje }
  if (p === '30d') return { de: diasAntes(hoje, 29), ate: hoje }
  return { de, ate }
}

/** 4,5 → "4,5 min"; 75 → "1 h 15 min"; null → "—". */
export function minutos(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v < 60) return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min`
  const h = Math.floor(v / 60)
  const m = Math.round(v % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}
