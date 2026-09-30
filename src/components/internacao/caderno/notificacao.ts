// GANCHO da notificação compulsória (LNNC, Portaria GM/MS 10.175 de
// 23/01/2026) para o Diagnóstico do episódio.
//
// O catálogo LNNC ainda não existe no banco: a onda 6 cria. O contrato que
// esta tela espera é uma RPC
//   public.notificacao_compulsoria_dos_cids(p_cids text[])
//   RETURNS TABLE (cid text, item int, agravo text, imediata boolean,
//                  destino text, condicao text)
// — uma linha por CID notificável: nº do item da portaria, nome do agravo,
// se a notificação é imediata (até 24 h), o destino da imediata (MS/SES/SMS)
// e a condição (ex.: dengue imediata só se óbito). Enquanto a RPC não existir,
// o gancho devolve `catalogo: false` e a tela não afirma nada sobre notificação.
import { useQuery } from '@tanstack/react-query'

import { rpc } from './comum'

export type ItemLnnc = {
  cid: string
  item: number | null
  agravo: string
  imediata: boolean
  destino: string | null
  condicao: string | null
}

export const FONTE_LNNC = 'LNNC do Ministério da Saúde, Portaria GM/MS nº 10.175, de 23/01/2026'

const semFuncao = (e: unknown) => {
  const x = e as { code?: string; message?: string }
  return x?.code === 'PGRST202' || x?.code === '42883' || /could not find the function|does not exist/i.test(x?.message ?? '')
}

export function useNotificacaoCompulsoria(cids: string[]) {
  const chave = [...new Set(cids.filter(Boolean))].sort()
  return useQuery({
    queryKey: ['lnnc-dos-cids', chave],
    enabled: chave.length > 0,
    retry: false,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<{ catalogo: boolean; itens: ItemLnnc[] }> => {
      try {
        const data = (await rpc('notificacao_compulsoria_dos_cids', { p_cids: chave })) as ItemLnnc[] | true
        return { catalogo: true, itens: Array.isArray(data) ? data : [] }
      } catch (e) {
        if (semFuncao(e)) return { catalogo: false, itens: [] }
        throw e
      }
    },
  })
}
