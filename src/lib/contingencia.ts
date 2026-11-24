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

export const MOTIVO_MINIMO = 10

/** Valor de <input type="datetime-local"> lido no fuso de Brasília (o mesmo de dataHoraInput). */
export function instanteDoCampo(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null
  const d = new Date(`${v.slice(0, 16)}:00-03:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * O que ainda falta para registrar (revisão de tela, M1): o botão nunca fica
 * desligado sem dizer por quê. Lista vazia = pronto.
 */
export function faltaParaRegistrar(c: { inicio: string; fim: string; motivo: string }): string[] {
  const falta: string[] = []
  const ini = instanteDoCampo(c.inicio)
  const fim = instanteDoCampo(c.fim)
  if (!ini) falta.push('a hora em que passou para o papel')
  if (!fim) falta.push('a hora em que o sistema voltou')
  if (ini && fim && fim.getTime() <= ini.getTime()) falta.push('o fim depois do início')
  const letras = c.motivo.trim().length
  if (letras < MOTIVO_MINIMO) {
    const n = MOTIVO_MINIMO - letras
    falta.push(letras === 0 ? 'o motivo' : `mais ${n} ${n === 1 ? 'letra' : 'letras'} no motivo`)
  }
  return falta
}

/** A contingência que terminou por último (para o estado no topo). */
export function ultimaContingencia(lista: Contingencia[]): Contingencia | null {
  let ultima: Contingencia | null = null
  for (const c of lista) if (!ultima || new Date(c.fim).getTime() > new Date(ultima.fim).getTime()) ultima = c
  return ultima
}

/** Contingências que ainda cabem para marcar reentrada num atendimento: o atendimento começou antes do fim (+30 min). */
export function contingenciasDoAtendimento(lista: Contingencia[], chegadaEm: string): Contingencia[] {
  const chegada = new Date(chegadaEm).getTime()
  return lista.filter((c) => chegada <= new Date(c.fim).getTime() + 30 * 60000)
}
