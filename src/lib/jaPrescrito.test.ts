import { test } from 'node:test'
import assert from 'node:assert/strict'

import { jaPrescritos, textoJaPrescrito, type ItemAtivo } from './jaPrescrito.ts'

const itens: ItemAtivo[] = [
  { medicamento_id: 'mag', descricao: 'Sulfato de magnésio solução injetável', via: 'EV', posologia: 'Agora' },
  { medicamento_id: 'mag', descricao: 'Sulfato de magnésio solução injetável', via: 'IM', posologia: 'Agora' },
  { medicamento_id: 'dip', descricao: 'Dipirona solução injetável', via: 'EV', posologia: '6/6h' },
  { medicamento_id: null, descricao: 'Cabeceira elevada', via: null, posologia: null },
]

test('M4: acha o item do mesmo medicamento e da mesma via, sem diferença de maiúsculas', () => {
  assert.deepEqual(jaPrescritos(itens, 'mag', 'ev').map((i) => i.via), ['EV'])
  assert.deepEqual(jaPrescritos(itens, 'mag', ' IM ').map((i) => i.via), ['IM'])
})

test('M4: outra via, outro medicamento, sem via ou sem medicamento não avisam', () => {
  assert.equal(jaPrescritos(itens, 'mag', 'VO').length, 0)
  assert.equal(jaPrescritos(itens, 'cef', 'EV').length, 0)
  assert.equal(jaPrescritos(itens, 'mag', '').length, 0)
  assert.equal(jaPrescritos(itens, null, 'EV').length, 0)
})

test('M4: texto do aviso com a frequência do item que já existe', () => {
  assert.equal(textoJaPrescrito(jaPrescritos(itens, 'mag', 'EV')), 'Já prescrito: Sulfato de magnésio solução injetável EV, Agora')
  assert.equal(textoJaPrescrito([]), null)
  assert.equal(
    textoJaPrescrito([itens[0], { ...itens[0], posologia: 'Contínuo' }]),
    'Já prescrito: Sulfato de magnésio solução injetável EV, Agora; Sulfato de magnésio solução injetável EV, Contínuo',
  )
})
