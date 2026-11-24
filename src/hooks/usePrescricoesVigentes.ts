// Prescrições vigentes da unidade que o farmacêutico já lê (revisão do perfil
// Farmacêutico, RT 24/11/2026: VA1 e DI3). Sem RPC nova: é a leitura da
// Dispensação (itens_para_dispensar, migration 20261130000001).
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

/** Um item de medicamento das prescrições vigentes (itens_para_dispensar, a leitura da Dispensação). */
export type ItemVigente = {
  item_id: string; paciente_id: string; paciente: string; setor: string | null; medicamento: string; medicamento_id: string
  dose: string | null; via: string | null; posologia: string | null; se_necessario: boolean
}

/**
 * As prescrições vigentes da unidade que o farmacêutico já lê (itens_para_dispensar,
 * com a mesma chave de cache da Dispensação sem busca). Só para quem age: o
 * gestor não tem a leitura da dispensação.
 */
export function usePrescricoesVigentes(unidade: string, ativo = true) {
  return useQuery({
    queryKey: ['itens-para-dispensar', unidade, ''],
    enabled: ativo,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('itens_para_dispensar', { p_unidade: unidade, p_busca: undefined })
      if (error) throw error
      return data as unknown as { farmaceutico: boolean; itens: ItemVigente[] }
    },
  })
}
