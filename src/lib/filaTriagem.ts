// Fila da triagem da enfermagem (EN2, revisão do perfil Enfermeiro, RT
// 24/11/2026): a lista da tela Triagem e o número do menu saem desta mesma
// leitura e da mesma chave de cache. Antes o menu contava todo episódio da
// unidade em triagem, e a lista só os dos setores da escala em curso: o menu
// dizia 1 com a lista vazia.
import { ordemTriagem } from '@/domain/prioridade'
import { setoresNaEscalaAgora } from '@/lib/rpcCasca'
import { supabase } from '@/lib/supabase'

/** O mínimo que a ordem da fila usa; a tela tipa a linha inteira (NaFila). */
type LinhaFila = { prioridades_legais: string[]; chegada_em: string }

export const chaveFilaTriagem = (unidadeId: string | undefined) => ['triagem-fila', unidadeId] as const

/** Quem espera triagem nos setores da escala em curso, na ordem da fila. */
export async function lerFilaTriagem<T extends LinhaFila = LinhaFila>(): Promise<T[]> {
  const { data: ids, error: e1 } = await setoresNaEscalaAgora()
  if (e1) throw e1
  const setores = (Array.isArray(ids) ? ids : []) as string[]
  if (setores.length === 0) return []
  const { data, error } = await supabase
    .from('episodios')
    .select('id, paciente_id, setor_id, chegada_em, queixa, prioridades_legais, paciente:pacientes(nome, nome_social, data_nascimento, prontuario, nome_mae, responsavel_nome, sexo, identidade_desconhecida, sinais_identificacao)')
    .in('setor_id', setores)
    .eq('etapa', 'triagem')
  if (error) throw error
  return ((data ?? []) as unknown as T[]).sort(ordemTriagem)
}
