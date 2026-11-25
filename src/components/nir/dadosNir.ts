// Dados da Internação do NIR (modelo do RT, 25/11/2026): os internados e a
// regulação (regulacao_pacientes, a mesma chave da lista de antes), as
// pendências da unidade, o mapa de leitos e os avisos. Migrations
// 20270421000040 e 20270425000030.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import type { MapaLeitos, PendenciaUnidade, Pessoa } from '@/lib/nirPainel'
import type { PacienteRegulacao } from '@/lib/regulacaoPaciente'
import { supabase } from '@/lib/supabase'
import type { MinhaNotificacao } from '@/types/database'

export const chavePendencias = (unidadeId: string) => ['nir-pendencias', unidadeId]
export const chaveMapa = (unidadeId: string) => ['nir-mapa-leitos', unidadeId]
export const chaveAvisos = (unidadeId: string) => ['minhas-notificacoes', unidadeId]

export function usePacientesNir(unidadeId: string) {
  return useQuery({
    queryKey: ['regulacao-pacientes', 'unidade', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_pacientes', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as PacienteRegulacao[]
    },
  })
}

export function usePendenciasNir(unidadeId: string) {
  return useQuery({
    queryKey: chavePendencias(unidadeId),
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_pendencias_da_unidade', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as PendenciaUnidade[]
    },
  })
}

export function useMapaLeitos(unidadeId: string) {
  return useQuery({
    queryKey: chaveMapa(unidadeId),
    enabled: !!unidadeId,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('nir_mapa_leitos', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? { setores: [], internados: [] }) as unknown as MapaLeitos
    },
  })
}

export function useMedicosDoSetor(unidadeId: string, setorId: string | null, ligado: boolean) {
  return useQuery({
    queryKey: ['nir-medicos-setor', unidadeId, setorId],
    enabled: !!unidadeId && ligado,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('nir_medicos_do_setor', { p_unidade: unidadeId, p_setor: setorId })
      if (error) throw error
      return data as unknown as { no_plantao: boolean; medicos: Pessoa[] }
    },
  })
}

export function useAvisosNir(unidadeId: string) {
  return useQuery({
    queryKey: chaveAvisos(unidadeId),
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_notificacoes', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as MinhaNotificacao[]
    },
  })
}

/** Recarrega o que a ação do NIR muda: a lista, as pendências e o pedido aberto. */
export function useRecarregarNir(unidadeId: string) {
  const qc = useQueryClient()
  return React.useCallback((solicitacaoId?: string) => {
    void qc.invalidateQueries({ queryKey: ['regulacao-pacientes'] })
    void qc.invalidateQueries({ queryKey: chavePendencias(unidadeId) })
    if (solicitacaoId) void qc.invalidateQueries({ queryKey: ['regulacao-detalhe', solicitacaoId] })
  }, [qc, unidadeId])
}

/** Reenviar o aviso e marcar resolvida (NIR2 e NIR3). */
export function useAcoesPendencia(aoMudar: () => void) {
  const reavisar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('regulacao_pendencia_unidade_reavisar', { p_id: id })
      if (error) throw error
    },
    onSuccess: aoMudar,
  })
  const resolver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('regulacao_pendencia_unidade_resolver', { p_id: id })
      if (error) throw error
    },
    onSuccess: aoMudar,
  })
  return { reavisar, resolver, erro: (reavisar.error ?? resolver.error) as Error | null }
}

export const tomStatus = (s: PendenciaUnidade['status']): 'success' | 'warning' | 'destructive' =>
  s === 'resolvida' ? 'success' : s === 'medico_avisado' ? 'warning' : 'destructive'
