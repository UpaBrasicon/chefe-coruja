// Filtros de BI da tela Indicadores (Fase 1, tarefa 7): uma barra só para
// todos os cartões, guardada no endereço da página (decisão do RT, 07/10/2026).
import { periodoDe, type Periodo } from './esperaTriagem.ts'

export type FiltrosBi = {
  periodo: Periodo
  de: string
  ate: string
  setor: string
  cor: string
  turno: string
  grupo: string
  medico: string
}

const PERIODOS: Periodo[] = ['hoje', '7d', '30d', 'intervalo']
const CORES = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul']
const TURNOS = ['manha', 'tarde', 'noite']
const GRUPOS = ['adulto', 'pediatrico']
const DIA = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i

/** Lê os filtros do endereço; valor fora da lista volta ao padrão (7 dias, sem filtro). */
export function lerFiltros(q: URLSearchParams, hoje: string): FiltrosBi {
  const so = (v: string | null, lista: string[]) => (v && lista.includes(v) ? v : '')
  const periodo = (PERIODOS as string[]).includes(q.get('periodo') ?? '') ? (q.get('periodo') as Periodo) : '7d'
  const de = DIA.test(q.get('de') ?? '') ? q.get('de')! : hoje
  const ate = DIA.test(q.get('ate') ?? '') ? q.get('ate')! : hoje
  return {
    periodo, de, ate,
    setor: UUID.test(q.get('setor') ?? '') ? q.get('setor')! : '',
    cor: so(q.get('cor'), CORES),
    turno: so(q.get('turno'), TURNOS),
    grupo: so(q.get('grupo'), GRUPOS),
    medico: UUID.test(q.get('medico') ?? '') ? q.get('medico')! : '',
  }
}

/** Grava só o que difere do padrão: o link fica curto. */
export function escreverFiltros(f: FiltrosBi): URLSearchParams {
  const q = new URLSearchParams()
  if (f.periodo !== '7d') q.set('periodo', f.periodo)
  if (f.periodo === 'intervalo') { q.set('de', f.de); q.set('ate', f.ate) }
  for (const k of ['setor', 'cor', 'turno', 'grupo', 'medico'] as const) if (f[k]) q.set(k, f[k])
  return q
}

/** Período resolvido + argumentos opcionais das RPCs (vazio = sem filtro). */
export function argsFiltros(f: FiltrosBi, hoje: string) {
  const faixa = periodoDe(f.periodo, hoje, f.de, f.ate)
  return {
    faixa,
    args: {
      p_de: faixa.de, p_ate: faixa.ate,
      p_setor: f.setor || undefined, p_cor: f.cor || undefined, p_turno: f.turno || undefined,
      p_publico: f.grupo || undefined, p_medico: f.medico || undefined,
    },
  }
}

/** Texto dos filtros para o cabeçalho do CSV. */
export function descreverFiltros(f: FiltrosBi, nomes: { setor?: string; medico?: string }): string {
  const partes: string[] = []
  if (f.setor) partes.push(`setor ${nomes.setor ?? f.setor}`)
  if (f.cor) partes.push(`cor ${f.cor}`)
  if (f.turno) partes.push(`turno ${f.turno === 'manha' ? 'manhã' : f.turno}`)
  if (f.grupo) partes.push(f.grupo === 'pediatrico' ? 'pediátrico' : 'adulto')
  if (f.medico) partes.push(`médico ${nomes.medico ?? f.medico}`)
  return partes.length ? partes.join(', ') : 'sem filtro'
}
