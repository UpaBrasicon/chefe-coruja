// Consultas da central para a fila do regulador (modelo do RT, 25/11/2026):
// a fila com os extras, as vagas compatíveis e as listas do lado da origem.
// Mesmas chaves de cache nas abas, no dossiê e nas contagens. Migration
// 20270425000020.
import { useQuery } from '@tanstack/react-query'

import type { Prioridade, StatusRegulacao } from '@/lib/regulacao'
import { comExtras, type Extra, type PedidoFila, type UnidadeVagas } from '@/lib/regulacaoFila'
import { esperandoDecisao } from '@/lib/regulacaoLinhaTempo'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export type ItemConsole = PedidoFila & {
  assumida_por: string | null; assumida_por_mim: boolean
  origem_latitude?: number | null; origem_longitude?: number | null
}

/** Fila da central com os extras; o status vai ao banco (vazio = em aberto). */
export function useFilaCentral(centralId: string, status: StatusRegulacao | '' = '') {
  const filtros = status ? { status: [status] } : {}
  const fila = useQuery({
    queryKey: ['regulacao-fila', centralId, filtros],
    enabled: !!centralId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_fila', { p_central: centralId, p_filtros: filtros as unknown as Json })
      if (error) throw error
      return data as unknown as { dados: ItemConsole[]; origens: { id: string; nome: string }[]; agora: string }
    },
  })
  const extras = useQuery({
    queryKey: ['regulacao-fila-extras', centralId],
    enabled: !!centralId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_fila_extras', { p_central: centralId })
      if (error) throw error
      return (data ?? []) as unknown as Extra[]
    },
  })
  const m = new Map((extras.data ?? []).map((e) => [e.id, e]))
  const itens = comExtras(fila.data?.dados ?? [], extras.data).map((s) => {
    const e = m.get(s.id)
    return e ? { ...s, origem_latitude: e.origem_latitude, origem_longitude: e.origem_longitude } : s
  })
  return { fila, extras, itens, atualizadoEm: fila.dataUpdatedAt }
}

export function useVagasCentral(centralId: string, ativo = true) {
  return useQuery({
    queryKey: ['regulacao-vagas-compativeis', centralId],
    enabled: ativo && !!centralId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_vagas_compativeis', { p_central: centralId })
      if (error) throw error
      return data as unknown as { unidades: UnidadeVagas[]; agora: string }
    },
  })
}

export type AbaOrigem = 'esperando' | 'enviados' | 'recebidos'

type PedidoDaLista = Omit<ItemConsole, 'espera_segundos' | 'assumida_por' | 'assumida_por_mim'> & {
  criada_em: string
  /** RO3 (migration 20270426000044): o mesmo isolamento que a central lê do extra da fila */
  isolamento_situacao?: string | null; isolamento_agente?: string | null
}
type PedidoRecebido = {
  id: string; numero: number; status: StatusRegulacao; prioridade: Prioridade; prioridade_regulador: Prioridade | null
  tipo_leito: string | null; paciente: { nome: string }; origem: { nome: string }
  destino_enviado_em?: string | null
}

/**
 * Lado da origem no console (perfil Médico regulador numa unidade que pede):
 * Esperando decisão e Enviados vêm da regulacao_lista (a mesma chave de cache
 * da página); Recebidos, da regulacao_destino_lista. O tempo na fila conta da
 * criação do pedido (no recebido, de quando a central mandou ao destino).
 */
export function useFilaOrigem(unidadeId: string, aba: AbaOrigem) {
  const lista = useQuery({
    queryKey: ['regulacao-lista', unidadeId],
    enabled: !!unidadeId && aba !== 'recebidos',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_lista', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as PedidoDaLista[]
    },
  })
  const destino = useQuery({
    queryKey: ['regulacao-destino', unidadeId],
    enabled: !!unidadeId && aba === 'recebidos',
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_destino_lista', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as PedidoRecebido[]
    },
  })
  const q = aba === 'recebidos' ? destino : lista
  const agora = q.dataUpdatedAt
  const seg = (iso: string | null | undefined) => (iso && agora ? Math.max(0, Math.floor((agora - Date.parse(iso)) / 1000)) : 0)
  const itens: ItemConsole[] = aba === 'recebidos'
    ? (destino.data ?? []).map((s) => ({
        id: s.id, numero: s.numero, status: s.status, prioridade: s.prioridade, prioridade_regulador: s.prioridade_regulador,
        tipo_leito: s.tipo_leito, isolamento: false, isolamento_tipo: null, vulnerabilidades: [], sla: null,
        origem: { id: '', nome: s.origem.nome }, paciente: s.paciente,
        espera_segundos: seg(s.destino_enviado_em), assumida_por: null, assumida_por_mim: false,
      }))
    : (lista.data ?? [])
        .filter((s) => (aba === 'esperando') === esperandoDecisao(s.status))
        .map((s) => ({
          ...s, espera_segundos: seg(s.criada_em), assumida_por: null, assumida_por_mim: false,
          situacao: s.isolamento_situacao ?? null, agente: s.isolamento_agente ?? null,
        }))
  return { itens, carregando: q.isLoading, erro: q.error, atualizadoEm: agora }
}

