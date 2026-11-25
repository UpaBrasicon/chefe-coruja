// node --experimental-strip-types --test src/lib/prescricaoLeito.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gruposDaPrescricao, opcoesSemMedicamento, textoDiluicao, tituloRenovacao } from './prescricaoLeito.ts'

const agora = Date.parse('2026-11-24T12:00:00Z')
const h = (n: number) => new Date(agora + n * 3600_000).toISOString()
const item = (id: string, validaAte: string | null, tipo = 'medicamento') => ({ id, tipo, valida_ate: validaAte })

test('vencido e vencendo (leito e porta) vão primeiro; o resto fica no grupo de origem', () => {
  const g = gruposDaPrescricao([item('a', h(-1)), item('b', h(10)), item('c', h(1))], [item('p1', h(-2)), item('p2', h(20))], agora)
  assert.deepEqual(g.vencidos.map((i) => i.id).sort(), ['a', 'c', 'p1'])
  assert.equal(g.vencidos.find((i) => i.id === 'p1')?.daPorta, true)
  assert.deepEqual(g.ativos.map((i) => i.id), ['b'])
  assert.deepEqual(g.porta.map((i) => i.id), ['p2'])
})

test('item sem validade ("Agora") não vai para a renovação', () => {
  const g = gruposDaPrescricao([item('a', null)], [], agora)
  assert.equal(g.vencidos.length, 0)
  assert.equal(g.ativos.length, 1)
})

test('título do grupo de renovação', () => {
  assert.equal(tituloRenovacao(2, 2), 'Vencidos')
  assert.equal(tituloRenovacao(1, 3), 'Vencidos e vencendo')
  assert.equal(tituloRenovacao(0, 1), 'Vencendo em até 2 horas')
})

test('diluição só aparece quando existe', () => {
  assert.equal(textoDiluicao({ diluicao_texto: null, diluicao_versao: null, diluicao_divergente: false, justificativa_divergencia: null }), null)
  assert.equal(textoDiluicao({ diluicao_texto: 'SF 0,9% 100 mL', diluicao_versao: 2, diluicao_divergente: false, justificativa_divergencia: null })?.fora, false)
  assert.equal(textoDiluicao({ diluicao_texto: 'AD 10 mL', diluicao_versao: 1, diluicao_divergente: true, justificativa_divergencia: 'restrição' })?.fora, true)
})

test('busca única oferece cuidado e contenção, sem dose', () => {
  const o = opcoesSemMedicamento('cabe', ['Cabeceira elevada', 'Dieta'])
  assert.deepEqual(o.map((x) => x.rotulo), ['Cabeceira elevada', 'cabe'])
  assert.ok(opcoesSemMedicamento('contenç', []).some((x) => x.tipo === 'contencao'))
  assert.deepEqual(opcoesSemMedicamento('d', ['Dieta']), [])
})
