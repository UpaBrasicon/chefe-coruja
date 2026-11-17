import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Ficha } from '@/clinico/ficha'
import type { Revisor } from '@/lib/comiteClinico'
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
  /** LG13: profissões que revisam esta ficha e as que ainda faltam nesta versão */
  revisoes_exigidas?: string[] | null
  revisoes_pendentes?: string[] | null
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

export type PapelTecnico = { tipo: Revisor; conselho: string; registro: string; uf: string }

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
      qc.invalidateQueries({ queryKey: ['aguardando-outra-profissao'] })
      qc.invalidateQueries({ queryKey: ['situacao-ferramenta'] })
    },
  })
}

// ------------------------------------------------ LG13: comitê clínico

/** Que profissões revisam cada ficha (ferramentas_clinicas.revisoes_exigidas). */
export function useRevisoesExigidas(habilitado: boolean) {
  return useQuery({
    queryKey: ['revisoes-exigidas'],
    enabled: habilitado,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('ferramentas_clinicas').select('id, revisoes_exigidas')
      if (error) throw error
      return Object.fromEntries((data ?? []).map((f) => [f.id, f.revisoes_exigidas])) as Record<string, string[]>
    },
  })
}

/** Versões que o médico já decidiu e esperam outra profissão. */
export function useAguardandoOutraProfissao(habilitado: boolean) {
  return useQuery({
    queryKey: ['aguardando-outra-profissao'],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ferramenta_versoes')
        .select('ferramenta_id, versao, ferramenta_revisoes(tipo)')
        .eq('status', 'aguardando_aprovacao')
      if (error) throw error
      return (data ?? []).filter((v) => v.ferramenta_revisoes.some((r) => r.tipo === 'medico'))
    },
  })
}

export function useFilaRevisao(tipo: Exclude<Revisor, 'medico'>) {
  return useQuery({
    queryKey: ['fila-revisao-ferramentas', tipo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_revisao_ferramentas', { p_tipo: tipo })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRevisarVersao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { ferramenta: string; versao: string; tipo: Exclude<Revisor, 'medico'>; aprovar: boolean; nota?: string }) => {
      const { data, error } = await supabase.rpc('revisar_versao_ferramenta', {
        p_ferramenta: v.ferramenta,
        p_versao: v.versao,
        p_tipo: v.tipo,
        p_aprovar: v.aprovar,
        p_nota: v.nota,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fila-revisao-ferramentas'] })
      qc.invalidateQueries({ queryKey: ['aguardando-outra-profissao'] })
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
