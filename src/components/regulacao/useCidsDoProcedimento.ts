// Consulta da lista de CID do procedimento SIGTAP (regra do RT de 24/11/2026;
// RPC regulacao_cids_do_procedimento, migration 20270423000010). Enquanto a
// RPC não existir no banco, devolve "sem lista" e a tela fica na busca livre.
import { useQuery } from '@tanstack/react-query'

import { SEM_LISTA, codigoProcedimento, conflitoCid, rpcAusente, type CidsDoProcedimento } from '@/lib/cidProcedimento'
import { supabase } from '@/lib/supabase'

type Erro = { code?: string; message?: string }
// a RPC é nova e ainda não está nos tipos gerados do banco
type ComRpcLivre = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Erro | null }> }

export async function cidsDoProcedimento(procedimento: string, termo: string | null, cid: string | null): Promise<CidsDoProcedimento> {
  const { data, error } = await (supabase as unknown as ComRpcLivre).rpc('regulacao_cids_do_procedimento', {
    p_procedimento: procedimento, p_termo: termo, p_cid: cid, p_limite: 50,
  })
  if (error) {
    if (rpcAusente(error)) return { ...SEM_LISTA, indisponivel: true }
    throw new Error(error.message ?? 'Não foi possível conferir o CID com o procedimento.')
  }
  return data as CidsDoProcedimento
}

/** Confere o CID com o procedimento; devolve a frase do conflito (ou null). Trocar o procedimento confere de novo. */
export function useConflitoCid(procedimento: string, cid: string) {
  const proc = codigoProcedimento(procedimento)
  const c = cid.trim()
  const q = useQuery({
    queryKey: ['regulacao-cid-procedimento', proc, c],
    enabled: !!proc && !!c,
    staleTime: 10 * 60_000,
    queryFn: () => cidsDoProcedimento(proc, null, c),
  })
  return { conflito: conflitoCid(proc, c, q.data), conferindo: q.isFetching && !q.data }
}
