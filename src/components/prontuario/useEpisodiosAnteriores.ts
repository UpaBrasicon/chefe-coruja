// Atendimento anterior SEM DESFECHO do paciente (decisão do usuário em
// 29/09/2026): sem alta, sem encaminhamento para outro setor e sem
// internação. O banco admite um só atendimento aberto por paciente
// (episodios_um_aberto_por_paciente), então é no máximo um — e ele costuma
// estar num setor que a RLS não abre para quem está no leito. A leitura é pela
// RPC atendimentos_sem_desfecho, que confere que o paciente está sob o
// cuidado de quem pede. O histórico encerrado não entra: segue pelo pedido de
// acesso ao prontuário (fase 6).
// Separado do componente para o fast refresh do Vite.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type AtendimentoSemDesfecho = {
  episodio_id: string
  chegada_em: string
  etapa: string
  queixa: string
  cor_atual: string | null
  classificado_em: string | null
  atendimento_iniciado_em: string | null
  setor_id: string | null
  setor_nome: string | null
  medico_nome: string | null
  ultimo_registro: string | null
  ultimo_registro_em: string | null
  /** O setor do atendimento está na escala de quem vê agora: dá para abrir e dar o desfecho. */
  noMeuPlantao: boolean
}

export function useEpisodiosAnteriores(pacienteId: string, episodioAtualId?: string | null) {
  return useQuery({
    queryKey: ['atendimentos-sem-desfecho', pacienteId, episodioAtualId ?? null],
    enabled: !!pacienteId,
    staleTime: 30_000,
    queryFn: async (): Promise<AtendimentoSemDesfecho[]> => {
      const [lista, escala] = await Promise.all([
        supabase.rpc('atendimentos_sem_desfecho', { p_paciente: pacienteId, ...(episodioAtualId ? { p_exceto: episodioAtualId } : {}) }),
        supabase.rpc('setores_na_escala_agora'),
      ])
      if (lista.error) throw lista.error
      const meus = new Set((Array.isArray(escala.data) ? escala.data : []) as string[])
      const eps = (lista.data ?? []) as Omit<AtendimentoSemDesfecho, 'noMeuPlantao' | 'setor_id'>[]
      if (!eps.length) return []
      // o setor do episódio (para saber se é da minha escala) vem da própria linha
      // quando a RLS deixa; senão, fica fora do meu plantão
      const { data: comSetor } = await supabase.from('episodios').select('id, setor_id').in('id', eps.map((e) => e.episodio_id))
      const setorDe = new Map((comSetor ?? []).map((e) => [e.id, e.setor_id as string]))
      return eps.map((e) => {
        const setor = setorDe.get(e.episodio_id) ?? null
        return { ...e, setor_id: setor, noMeuPlantao: !!setor && meus.has(setor) }
      })
    },
  })
}
