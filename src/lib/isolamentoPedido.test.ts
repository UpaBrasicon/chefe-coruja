// node --experimental-strip-types --test src/lib/isolamentoPedido.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { rotulosIsolamento, textoIsolamento, tiposDoIsolamento } from './isolamentoPedido.ts'

test('B-04: gotícula marcada no paciente e reverso pedido aparecem os dois', () => {
  const p = { isolamento_tipo: 'reverso', isolamento_tipos: ['goticula', 'reverso'] }
  assert.deepEqual(tiposDoIsolamento(p), ['goticula', 'reverso'])
  assert.deepEqual(rotulosIsolamento(p), ['Gotícula', 'Reverso (protetor)'])
  assert.equal(textoIsolamento(p), 'Gotícula e reverso (protetor)')
})

test('lista vazia ou ausente cai no tipo principal', () => {
  assert.deepEqual(tiposDoIsolamento({ isolamento_tipo: 'aerossol', isolamento_tipos: [] }), ['aerossol'])
  assert.deepEqual(tiposDoIsolamento({ isolamento_tipo: 'aerossol', isolamento_tipos: null }), ['aerossol'])
  assert.deepEqual(tiposDoIsolamento({ isolamento_tipo: 'contato' }), ['contato'])
  assert.equal(textoIsolamento({ isolamento_tipo: 'contato_aerossol', isolamento_tipos: [] }), 'Contato + aerossol')
})

test('sem tipo nenhum: lista vazia e texto nulo', () => {
  assert.deepEqual(tiposDoIsolamento({ isolamento_tipo: null, isolamento_tipos: [] }), [])
  assert.deepEqual(tiposDoIsolamento({}), [])
  assert.equal(textoIsolamento({ isolamento_tipo: '', isolamento_tipos: null }), null)
})

test('um tipo só na lista: o rótulo dele', () => {
  assert.equal(textoIsolamento({ isolamento_tipo: 'goticula', isolamento_tipos: ['goticula'] }), 'Gotícula')
})

test('contato + aerossol pedido continua um tipo só, somado ao resto', () => {
  assert.deepEqual(tiposDoIsolamento({ isolamento_tipo: 'contato_aerossol', isolamento_tipos: ['aerossol', 'contato'] }), ['contato_aerossol'])
  const p = { isolamento_tipo: 'contato_aerossol', isolamento_tipos: ['aerossol', 'contato', 'reverso'] }
  assert.deepEqual(tiposDoIsolamento(p), ['contato_aerossol', 'reverso'])
  assert.equal(textoIsolamento(p), 'Contato + aerossol e reverso (protetor)')
})

test('três tipos: vírgula e "e" no fim, na ordem do servidor', () => {
  const p = { isolamento_tipo: 'aerossol', isolamento_tipos: ['aerossol', 'goticula', 'contato'] }
  assert.equal(textoIsolamento(p), 'Aerossol, gotícula e contato')
})

test('repetido e vazio na lista não aparecem; tipo desconhecido sai como veio', () => {
  assert.deepEqual(tiposDoIsolamento({ isolamento_tipo: 'contato', isolamento_tipos: ['contato', 'contato', ''] }), ['contato'])
  assert.deepEqual(rotulosIsolamento({ isolamento_tipo: 'x', isolamento_tipos: ['x', 'contato'] }), ['x', 'Contato'])
})
