// "Meus atendimentos" × "Da unidade" na notificação compulsória (revisão do
// médico, RT 24/11/2026, M3). Meu atendimento é o episódio em que fui o médico
// do atendimento ou registrei o desfecho, e a internação em que dei a alta ou
// que veio de um episódio meu. Só leitura, pelas tabelas que a tela já usa (a
// RLS decide o que cada um lê); nada muda no banco.
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

import type { Caso } from './dados'

const emLotes = <T,>(xs: T[], n = 100) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

/** Chaves dos casos que são meus atendimentos. */
export function useMeusAtendimentos(casos: Caso[] | undefined) {
  const { perfil } = useAuth()
  const eu = perfil?.id
  const eps = [...new Set((casos ?? []).map((c) => c.episodio_id).filter((x): x is string => !!x))].sort()
  const ints = [...new Set((casos ?? []).map((c) => c.internacao_id).filter((x): x is string => !!x))].sort()
  return useQuery({
    queryKey: ['notificacao-meus-atendimentos', eu, eps.join(','), ints.join(',')],
    enabled: !!eu && eps.length + ints.length > 0,
    queryFn: async () => {
      const meusEp = new Set<string>()
      for (const lote of emLotes(eps)) {
        const { data, error } = await supabase.from('episodios').select('id, atendimento_medico_id, desfecho_por').in('id', lote)
        if (error) throw error
        for (const e of data ?? []) if (e.atendimento_medico_id === eu || e.desfecho_por === eu) meusEp.add(e.id)
      }
      const meusInt = new Set<string>()
      for (const lote of emLotes(ints)) {
        const { data, error } = await supabase.from('internacoes').select('id, episodio_id, alta_por').in('id', lote)
        if (error) throw error
        for (const i of data ?? []) if (i.alta_por === eu || (i.episodio_id && meusEp.has(i.episodio_id))) meusInt.add(i.id)
      }
      return new Set((casos ?? [])
        .filter((c) => (c.episodio_id && meusEp.has(c.episodio_id)) || (c.internacao_id && meusInt.has(c.internacao_id)))
        .map((c) => c.chave))
    },
  })
}
