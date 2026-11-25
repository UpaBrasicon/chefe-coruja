// Consultas da central para a fila do regulador (modelo do RT, 25/11/2026):
// a fila com os extras e as vagas compatíveis. Mesmas chaves de cache nas
// abas, no dossiê e nas contagens. Migration 20270425000020.
import { useQuery } from '@tanstack/react-query'

import type { StatusRegulacao } from '@/lib/regulacao'
import { comExtras, type Extra, type PedidoFila, type UnidadeVagas } from '@/lib/regulacaoFila'
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

