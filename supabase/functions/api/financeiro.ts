// Regras puras da porta do ERP (Fase 5C, tarefa 3, etapa 3.3): rota → ação de
// public.api_v1_financeiro, conferência dos parâmetros e do corpo do retorno.
// Sem Deno nem rede, para testar no Node (financeiro.test.ts). O banco confere
// de novo e decide (chave, escopo, versão vigente ou substituída, reenvio).
//
//   GET  /financeiro/contas                                 → contas
//   GET  /financeiro/contas/{conta_id}                      → conta (todas as versões)
//   POST /financeiro/contas/{conta_id}/versoes/{n}/retorno  → retorno
//   GET  /financeiro/plantoes                               → plantoes
//   POST /financeiro/plantoes/{versao_id}/retorno           → plantoes_retorno

import type { CodigoErro } from './contrato.ts'

export type AcaoFinanceiro = 'contas' | 'conta' | 'retorno' | 'plantoes' | 'plantoes_retorno'
type Recusa = { erro: { status: number; codigo: CodigoErro; detalhe: string } }
export type RotaFinanceiro = { acao: AcaoFinanceiro; metodo: 'GET' | 'POST'; dados: Record<string, string | number> }
export type Retorno = { acao: 'lancada' | 'estornada'; erp_id?: string; recebida_em?: string; valor_lancado?: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COMPETENCIA = /^[0-9]{4}(0[1-9]|1[0-2])$/
const SITUACOES = ['vigente', 'substituida']
const CONCILIACOES = ['pendente', 'conciliada', 'divergente', 'estornada']

const invalido = (detalhe: string, status = 400): Recusa => ({ erro: { status, codigo: 'requisicao_invalida', detalhe } })
const naoEncontrado: Recusa = { erro: { status: 404, codigo: 'nao_encontrado', detalhe: 'Recurso inexistente.' } }
const dataHora = (v: string) => !Number.isNaN(Date.parse(v)) && /\d{4}-\d{2}-\d{2}T/.test(v)

/** Rota + método + query → ação e parâmetros conferidos, ou o erro do contrato. */
export function rotaFinanceiro(caminho: string, metodo: string, query: URLSearchParams): RotaFinanceiro | Recusa {
  const seg = caminho.split('/').filter(Boolean)
  if (seg[0] !== 'financeiro') return naoEncontrado
  const dados: Record<string, string | number> = {}
  const pega = (nome: string, regra: (v: string) => boolean, msg: string): Recusa | null => {
    const v = query.get(nome)
    if (v === null || v === '') return null
    if (!regra(v)) return invalido(msg)
    dados[nome] = v
    return null
  }
  const lista = (): Recusa | null => {
    const l = query.get('limite')
    if (l !== null && l !== '') {
      const n = Number(l)
      if (!Number.isInteger(n) || n < 1 || n > 100) return invalido('limite vai de 1 a 100.')
      dados.limite = n
    }
    return pega('unidade_id', (v) => UUID.test(v), 'unidade_id não é um UUID.')
      ?? pega('desde', dataHora, 'desde em ISO 8601 (ex.: 2026-10-01T00:00:00-03:00).')
      ?? pega('situacao', (v) => SITUACOES.includes(v), 'situacao: vigente ou substituida.')
      ?? pega('conciliacao', (v) => CONCILIACOES.includes(v), 'conciliacao: pendente, conciliada, divergente ou estornada.')
      ?? pega('cursor', () => true, '')
  }
  const so = (m: 'GET' | 'POST'): Recusa | null =>
    metodo === m ? null : invalido(m === 'GET' ? 'Este endereço só aceita GET.' : 'Este endereço só aceita POST.', 405)

  let r: RotaFinanceiro | null = null
  let erro: Recusa | null = null
  if (seg[1] === 'contas' && seg.length === 2) {
    erro = so('GET') ?? lista()
    r = { acao: 'contas', metodo: 'GET', dados }
  } else if (seg[1] === 'contas' && seg.length === 3) {
    if (!UUID.test(seg[2])) return naoEncontrado
    erro = so('GET')
    r = { acao: 'conta', metodo: 'GET', dados: { conta_id: seg[2] } }
  } else if (seg[1] === 'contas' && seg.length === 6 && seg[3] === 'versoes' && seg[5] === 'retorno') {
    if (!UUID.test(seg[2]) || !/^[1-9][0-9]{0,5}$/.test(seg[4])) return naoEncontrado
    erro = so('POST')
    r = { acao: 'retorno', metodo: 'POST', dados: { conta_id: seg[2], versao: Number(seg[4]) } }
  } else if (seg[1] === 'plantoes' && seg.length === 2) {
    erro = so('GET') ?? lista() ?? pega('competencia', (v) => COMPETENCIA.test(v), 'competencia no formato AAAAMM.')
    r = { acao: 'plantoes', metodo: 'GET', dados }
  } else if (seg[1] === 'plantoes' && seg.length === 4 && seg[3] === 'retorno') {
    if (!UUID.test(seg[2])) return naoEncontrado
    erro = so('POST')
    r = { acao: 'plantoes_retorno', metodo: 'POST', dados: { versao_id: seg[2] } }
  }
  if (!r) return naoEncontrado
  return erro ?? r
}

/** Corpo do POST de retorno do ERP. */
export function lerRetorno(corpo: unknown): Retorno | Recusa {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return invalido('O corpo é um objeto JSON.')
  const c = corpo as Record<string, unknown>
  if (c.acao !== 'lancada' && c.acao !== 'estornada') return invalido('acao: lancada ou estornada.')
  const r: Retorno = { acao: c.acao }
  if (c.erp_id !== undefined && c.erp_id !== null) {
    if (typeof c.erp_id !== 'string' || c.erp_id.trim().length < 1 || c.erp_id.trim().length > 100) return invalido('erp_id de 1 a 100 letras.')
    r.erp_id = c.erp_id.trim()
  }
  if (c.recebida_em !== undefined && c.recebida_em !== null) {
    if (typeof c.recebida_em !== 'string' || !dataHora(c.recebida_em)) return invalido('recebida_em em ISO 8601.')
    r.recebida_em = c.recebida_em
  }
  if (c.valor_lancado !== undefined && c.valor_lancado !== null) {
    if (typeof c.valor_lancado !== 'number' || !Number.isFinite(c.valor_lancado) || c.valor_lancado < 0) return invalido('valor_lancado: número, zero ou mais.')
    r.valor_lancado = c.valor_lancado
  }
  if (r.acao === 'lancada' && (r.erp_id === undefined || r.valor_lancado === undefined)) {
    return invalido('acao "lancada" pede erp_id e valor_lancado.')
  }
  return r
}
