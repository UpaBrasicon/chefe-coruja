// Contingência em papel (Fase 1, tarefa 12): formatos das RPCs e a duração por extenso.

export type Contingencia = {
  id: string; inicio: string; fim: string; motivo: string
  registrado_por: string | null; registrado_em: string
  reentradas: number; atendimentos_no_periodo: number
}

export type Reentrada = { id: string; descricao: string; registrado_em: string; registrado_por: string | null; inicio: string; fim: string }

/** 95 min → "1 h 35 min no papel". */
export function duracaoContingencia(inicio: string, fim: string): string {
  const min = Math.max(0, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000))
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m || !h ? `${m} min` : ''} no papel`
}

/** Contingências que ainda cabem para marcar reentrada num atendimento: o atendimento começou antes do fim (+30 min). */
export function contingenciasDoAtendimento(lista: Contingencia[], chegadaEm: string): Contingencia[] {
  const chegada = new Date(chegadaEm).getTime()
  return lista.filter((c) => chegada <= new Date(c.fim).getTime() + 30 * 60000)
}
