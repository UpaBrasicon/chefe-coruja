import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ehTema, temaEfetivo } from './tema.ts'

test('tema: escolha da pessoa vale quando o escuro está liberado', () => {
  assert.equal(temaEfetivo('claro', true, true), 'claro')
  assert.equal(temaEfetivo('escuro', false, true), 'escuro')
  assert.equal(temaEfetivo('automatico', true, true), 'escuro')
  assert.equal(temaEfetivo('automatico', false, true), 'claro')
})

test('tema: antes da liberação a tela fica sempre clara (decisão 3a)', () => {
  assert.equal(temaEfetivo('escuro', true, false), 'claro')
  assert.equal(temaEfetivo('automatico', true, false), 'claro')
})

test('tema: só aceita os três valores', () => {
  assert.ok(ehTema('automatico'))
  assert.ok(!ehTema('roxo'))
  assert.ok(!ehTema(null))
})
