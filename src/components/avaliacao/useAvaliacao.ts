// ─────────────────────────────────────────────────────────────────────────────
// Avaliação e crescimento — dados (separado dos componentes para o fast refresh
// do Vite). As contas estão em src/clinico/crescimento; as regras de escrita,
// na migration 20261004000003.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { EscalaAvaliacao, Respostas } from '@/clinico/crescimento/escalasAvaliacao'
import { abrirProntuario } from '@/lib/prontuario'
import { supabase } from '@/lib/supabase'

export type AvaliacaoRegistro = {
  id: string
  escala: EscalaAvaliacao
  versao: string
  respostas: Respostas
  total: number
  interpretacao: string
  registrado_em: string
  autor: string | null
  cancelada_em: string | null
  cancelada_por: string | null
  motivo_cancelamento: string | null
}

export type Grandeza = 'peso' | 'estatura' | 'perimetro-cefalico'
export type MedidaObs = { id: string; grandeza: Grandeza; aferidoEm: string; valor: number }

export const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : ''
export const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
export const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
export const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
export const num = (s: string) => { const n = Number(s.replace(',', '.').trim()); return s.trim() && Number.isFinite(n) ? n : null }
export const br = (n: number, casas = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/** Nascimento e sexo do cadastro: a curva e a escolha da escala dependem deles. */
export function usePacienteCurva(pacienteId: string) {
  return useQuery({
    queryKey: ['paciente-curva', pacienteId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('data_nascimento, sexo').eq('id', pacienteId).maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Paciente não encontrado.')
      return data
    },
  })
}

export function useAvaliacoes(pacienteId: string) {
  return useQuery({
    queryKey: ['avaliacoes', pacienteId],
    staleTime: 10_000,
    queryFn: async (): Promise<AvaliacaoRegistro[]> => {
      const { data, error } = await supabase.rpc('avaliacoes_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data as unknown as AvaliacaoRegistro[]) ?? []
    },
  })
}

/**
 * Peso, estatura e perímetro cefálico já registrados (observacao + conceito
 * globais) — da triagem, do leito ou lançados na própria aba. Abre o
 * prontuário antes (sem isso a observação volta vazia).
 */
export function useMedidasCrescimento(pacienteId: string, internacaoId?: string | null) {
  return useQuery({
    queryKey: ['medidas-crescimento', pacienteId],
    staleTime: 15_000,
    queryFn: async (): Promise<MedidaObs[]> => {
      await abrirProntuario(pacienteId, internacaoId)
      const { data: conceitos, error: e1 } = await supabase.from('conceito').select('id, nome')
        .is('unidade_id', null).in('nome', ['peso', 'estatura', 'perimetro-cefalico'])
      if (e1) throw e1
      const nomePorId = new Map((conceitos ?? []).map((c) => [c.id, c.nome as Grandeza]))
      if (nomePorId.size === 0) return []
      const { data, error } = await supabase.from('observacao').select('id, conceito_id, aferido_em, valor_num')
        .eq('paciente_id', pacienteId).in('conceito_id', [...nomePorId.keys()]).not('valor_num', 'is', null)
        .order('aferido_em', { ascending: true })
      if (error) throw error
      return (data ?? []).map((o) => ({ id: o.id, grandeza: nomePorId.get(o.conceito_id)!, aferidoEm: o.aferido_em, valor: Number(o.valor_num) }))
    },
  })
}

export function useRecarregarAvaliacao(pacienteId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['avaliacoes', pacienteId] })
    void qc.invalidateQueries({ queryKey: ['medidas-crescimento', pacienteId] })
  }
}
