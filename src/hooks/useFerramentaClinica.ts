import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Ficha } from '@/clinico/ficha'
import { supabase } from '@/lib/supabase'

// Situação de uma ferramenta do pacote src/clinico: aprovação da camada base
// (responsável técnico) e camada vigente da unidade.

export type SituacaoFerramenta = {
  registrada: boolean
  status: 'aguardando_aprovacao' | 'aprovada' | 'reprovada' | 'substituida' | 'nao_registrada'
  decidida_por: string | null
  decisao_registro: string | null
  decidida_em: string | null
  decisao_nota: string | null
  unidade: { oculta: boolean; nota_local: string | null; definida_em: string; definida_por: string | null } | null
}

export function useSituacaoFerramenta(ficha: Ficha | undefined, unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['situacao-ferramenta', ficha?.id, ficha?.versao, unidadeId],
    enabled: !!ficha,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('situacao_ferramenta', {
        p_ferramenta: ficha!.id,
        p_versao: ficha!.versao,
        p_unidade: unidadeId,
      })
      if (error) throw error
      return data as unknown as SituacaoFerramenta
    },
  })
}

export type PapelTecnico = { tipo: 'medico' | 'farmaceutico'; conselho: string; registro: string; uf: string }

export function useMeuPapelTecnico() {
  return useQuery({
    queryKey: ['meu-papel-tecnico'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meu_papel_tecnico')
      if (error) throw error
      return (data ?? []) as unknown as PapelTecnico[]
    },
  })
}

export function useFilaAprovacao(habilitado: boolean) {
  return useQuery({
    queryKey: ['fila-aprovacao-ferramentas'],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_aprovacao_ferramentas')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useDecidirVersao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { ferramenta: string; versao: string; aprovar: boolean; nota?: string }) => {
      const { error } = await supabase.rpc('decidir_versao_ferramenta', {
        p_ferramenta: v.ferramenta,
        p_versao: v.versao,
        p_aprovar: v.aprovar,
        p_nota: v.nota,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fila-aprovacao-ferramentas'] })
      qc.invalidateQueries({ queryKey: ['situacao-ferramenta'] })
    },
  })
}

export function useFerramentasDaUnidade(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['ferramentas-da-unidade', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ferramentas_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useDefinirCamadaUnidade(unidadeId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { ferramenta: string; oculta: boolean; nota: string; motivo: string }) => {
      const { error } = await supabase.rpc('definir_ferramenta_unidade', {
        p_unidade: unidadeId!,
        p_ferramenta: v.ferramenta,
        p_oculta: v.oculta,
        p_nota: v.nota,
        p_motivo: v.motivo,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ferramentas-da-unidade', unidadeId] })
      qc.invalidateQueries({ queryKey: ['situacao-ferramenta'] })
    },
  })
}
