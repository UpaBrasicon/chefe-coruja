// Renovar e alterar um item só (PR1 e PM4, RT 24/11/2026), à parte dos componentes para o fast refresh.
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

/**
 * Alterar um item de medicamento (Fase 2, tarefa 6): a mesma
 * alterar_item_prescricao do AlterarItem e da linha "Alterando" da folha do
 * leito (PM4). A versão anterior fica guardada; a nova passa pelas travas.
 */
export async function alterarItemPrescricao(itemId: string, motivo: string,
  f: { dose: string; via: string; posologia: string; se_necessario: boolean }): Promise<string | null> {
  const { error } = await supabase.rpc('alterar_item_prescricao', {
    p_item: itemId, p_motivo: motivo.trim(),
    p_mudancas: { dose: f.dose.trim(), via: f.via, posologia: f.posologia.trim(), se_necessario: f.se_necessario },
  })
  return error ? error.message : null
}
