// Renovar um item só (PR1, RT 24/11/2026), à parte do componente para o fast refresh.
import { supabase } from '@/lib/supabase'
import { decisoesParaServidor } from '@/lib/validadePrescricao'
import type { Json } from '@/types/database'

/**
 * Renovar um item só, como está (PR1: "renovar por linha"). É a mesma
 * renovar_prescricao com a decisão "manter" de um item: o médico olhou a linha.
 */
export async function renovarItem(pacienteId: string, itemId: string): Promise<string | null> {
  const { error } = await supabase.rpc('renovar_prescricao', {
    p_paciente: pacienteId, p_decisoes: decisoesParaServidor([{ id: itemId, d: { acao: 'manter', motivo: '', mudancas: { dose: '', via: '', posologia: '', se_necessario: false } } }]) as unknown as Json,
  })
  return error ? error.message : null
}
