// node --experimental-strip-types --test supabase/functions/api/financeiro.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lerRetorno, rotaFinanceiro } from './financeiro.ts'

const C = '21000000-0000-4000-8000-000000000001'
const q = (s: string) => new URLSearchParams(s)
const e = (r: unknown) => (r as { erro?: { status: number; detalhe: string } }).erro

test('rotas do ERP', () => {
  assert.deepEqual(rotaFinanceiro('/financeiro/contas', 'GET', q('')), { acao: 'contas', metodo: 'GET', dados: {} })
  assert.deepEqual(rotaFinanceiro(`/financeiro/contas/${C}`, 'GET', q('')), { acao: 'conta', metodo: 'GET', dados: { conta_id: C } })
  assert.deepEqual(rotaFinanceiro(`/financeiro/contas/${C}/versoes/2/retorno`, 'POST', q('')),
    { acao: 'retorno', metodo: 'POST', dados: { conta_id: C, versao: 2 } })
  assert.deepEqual(rotaFinanceiro('/financeiro/plantoes', 'GET', q('competencia=202609&situacao=vigente')),
    { acao: 'plantoes', metodo: 'GET', dados: { situacao: 'vigente', competencia: '202609' } })
  assert.deepEqual(rotaFinanceiro(`/financeiro/plantoes/${C}/retorno`, 'POST', q('')),
    { acao: 'plantoes_retorno', metodo: 'POST', dados: { versao_id: C } })
})

test('parâmetros e método conferidos antes do banco', () => {
  assert.deepEqual((rotaFinanceiro('/financeiro/contas', 'GET', q(`unidade_id=${C}&limite=20&conciliacao=divergente`)) as { dados: unknown }).dados,
    { limite: 20, unidade_id: C, conciliacao: 'divergente' })
  assert.equal(e(rotaFinanceiro('/financeiro/contas', 'GET', q('limite=500')))?.detalhe, 'limite vai de 1 a 100.')
  assert.equal(e(rotaFinanceiro('/financeiro/contas', 'GET', q('unidade_id=x')))?.status, 400)
  assert.equal(e(rotaFinanceiro('/financeiro/contas', 'GET', q('desde=ontem')))?.status, 400)
  assert.equal(e(rotaFinanceiro('/financeiro/contas', 'GET', q('situacao=aberta')))?.status, 400)
  assert.equal(e(rotaFinanceiro('/financeiro/plantoes', 'GET', q('competencia=202613')))?.detalhe, 'competencia no formato AAAAMM.')
  assert.equal(e(rotaFinanceiro('/financeiro/contas', 'POST', q('')))?.status, 405)
  assert.equal(e(rotaFinanceiro(`/financeiro/contas/${C}/versoes/1/retorno`, 'GET', q('')))?.status, 405)
  assert.equal(e(rotaFinanceiro('/financeiro/contas/nao-uuid', 'GET', q('')))?.status, 404)
  assert.equal(e(rotaFinanceiro(`/financeiro/contas/${C}/versoes/0/retorno`, 'POST', q('')))?.status, 404)
  assert.equal(e(rotaFinanceiro('/financeiro', 'GET', q('')))?.status, 404)
  assert.equal(e(rotaFinanceiro('/financeiro/folha', 'GET', q('')))?.status, 404)
})

test('corpo do retorno', () => {
  assert.deepEqual(lerRetorno({ acao: 'lancada', erp_id: ' NF-1 ', valor_lancado: 13.74, recebida_em: '2026-10-27T10:00:00-03:00' }),
    { acao: 'lancada', erp_id: 'NF-1', valor_lancado: 13.74, recebida_em: '2026-10-27T10:00:00-03:00' })
  assert.deepEqual(lerRetorno({ acao: 'estornada' }), { acao: 'estornada' })
  assert.equal(e(lerRetorno({ acao: 'lancada', erp_id: 'NF-1' }))?.detalhe, 'acao "lancada" pede erp_id e valor_lancado.')
  assert.equal(e(lerRetorno({ acao: 'paga' }))?.detalhe, 'acao: lancada ou estornada.')
  assert.equal(e(lerRetorno({ acao: 'lancada', erp_id: 'NF-1', valor_lancado: '13,74' }))?.status, 400)
  assert.equal(e(lerRetorno({ acao: 'lancada', erp_id: 'NF-1', valor_lancado: -1 }))?.status, 400)
  assert.equal(e(lerRetorno({ acao: 'lancada', erp_id: 'x'.repeat(101), valor_lancado: 1 }))?.status, 400)
  assert.equal(e(lerRetorno({ acao: 'estornada', recebida_em: 'ontem' }))?.status, 400)
  assert.equal(e(lerRetorno([]))?.status, 400)
  assert.equal(e(lerRetorno(null))?.status, 400)
})
