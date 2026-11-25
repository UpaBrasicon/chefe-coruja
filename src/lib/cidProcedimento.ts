// CID compatível com o procedimento SIGTAP no pedido de regulação (regra do
// RT de 24/11/2026). Quando o procedimento tem lista de CID no SIGTAP, o CID do
// pedido precisa estar nela; o que não está aparece como conflito e trava o
// envio. Sem lista, a busca do CID é livre. A lista vem da RPC
// regulacao_cids_do_procedimento (migration 20270423000010); o banco recusa o
// CID fora da lista também.
// node --experimental-strip-types --test src/lib/cidProcedimento.test.ts

export type CidDaLista = { codigo: string; descricao: string; principal: boolean }
export type CidsDoProcedimento = {
  procedimento: string | null
  /** O procedimento tem lista de CID no SIGTAP. */
  tem_lista: boolean
  competencia: string | null
  total: number
  /** O CID consultado está na lista (null sem CID ou sem lista). */
  compativel: boolean | null
  principal: boolean | null
  itens: CidDaLista[]
  /** A RPC ainda não existe no banco: a tela volta à busca livre, sem conferir. */
  indisponivel?: boolean
}

export const SEM_LISTA: CidsDoProcedimento = {
  procedimento: null, tem_lista: false, competencia: null, total: 0, compativel: null, principal: null, itens: [],
}

/** Código SIGTAP só com os dígitos ("03.03.14.015-1" → "0303140151"). */
export const codigoProcedimento = (p: string | null | undefined) => (p ?? '').replace(/\D/g, '')

/** A frase do conflito, ou null quando não há conflito (sem CID, sem procedimento, sem lista ou compatível). */
export function conflitoCid(procedimento: string | null | undefined, cid: string | null | undefined, r: CidsDoProcedimento | null | undefined): string | null {
  const proc = codigoProcedimento(procedimento)
  const c = (cid ?? '').trim().toUpperCase()
  if (!proc || !c || !r || !r.tem_lista || r.compativel !== false) return null
  return `CID ${c} não é compatível com o procedimento ${proc}. Escolha um CID da lista do procedimento ou troque o procedimento.`
}

/** O que entra no "Falta:" do pedido quando há conflito. */
export const FALTA_CID_COMPATIVEL = 'CID compatível com o procedimento'

/** O erro da RPC que ainda não existe (PostgREST: função não encontrada). */
export function rpcAusente(erro: { code?: string; message?: string } | null | undefined): boolean {
  if (!erro) return false
  return erro.code === 'PGRST202' || erro.code === '42883' || /could not find the function|does not exist/i.test(erro.message ?? '')
}
