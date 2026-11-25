import { useQueries } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { resumoValidade, textoResumoValidade, type ComValidade, type SeloValidade } from '@/lib/validadePrescricao'

// Validade da prescrição do paciente (lacuna 6): as mesmas leituras e chaves do
// aviso do leito e da aba Prescrição. Usadas também na linha da lista de
// internados, para a linha e o caderno dizerem a mesma coisa (M3 da revisão do
// médico, RT 24/11/2026).

export type ItemVigenteValidade = ComValidade & { tipo: string }

export const opcoesPrescricaoVigente = (pacienteId: string) => ({
  queryKey: ['prescricao-vigente', pacienteId],
  retry: false,
  queryFn: async () => {
    const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: pacienteId })
    if (error) throw error
    return (data ?? []) as unknown as ItemVigenteValidade[]
  },
})

export const opcoesPrescricaoPortaAtiva = (pacienteId: string) => ({
  queryKey: ['prescricao-porta-ativa', pacienteId],
  retry: false,
  queryFn: async () => {
    const { data, error } = await supabase.rpc('prescricao_porta_ativa', { p_paciente: pacienteId })
    if (error) throw error
    return (data ?? []) as unknown as ItemVigenteValidade[]
  },
})

/** Resumo da validade de vários pacientes: id → selo ("Prescrição vencida: 1 item"), ou nada. */
export function useValidadeDosPacientes(ids: string[], agora: number): Map<string, SeloValidade> {
  const consultas = useQueries({
    queries: ids.flatMap((id) => [opcoesPrescricaoVigente(id), opcoesPrescricaoPortaAtiva(id)]),
  })
  const m = new Map<string, SeloValidade>()
  ids.forEach((id, k) => {
    const itens = [...(consultas[2 * k]?.data ?? []), ...(consultas[2 * k + 1]?.data ?? [])]
    const t = textoResumoValidade(resumoValidade(itens, agora), agora)
    if (t) m.set(id, t)
  })
  return m
}
