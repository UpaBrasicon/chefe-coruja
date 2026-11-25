// node --experimental-strip-types --test src/lib/tempoSemEvolucao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { tempoSemEvolucao } from './tempoSemEvolucao.ts'

test('até 47 h mostra horas', () => {
  assert.equal(tempoSemEvolucao(0), '0 h')
  assert.equal(tempoSemEvolucao(26), '26 h')
  assert.equal(tempoSemEvolucao(47), '47 h')
})

test('a partir de 48 h mostra dias e horas', () => {
  assert.equal(tempoSemEvolucao(48), '2 d 0 h')
  assert.equal(tempoSemEvolucao(72), '3 d 0 h')
  assert.equal(tempoSemEvolucao(1071), '44 d 15 h')
})

test('sem valor mostra traço', () => {
  assert.equal(tempoSemEvolucao(null), '—')
  assert.equal(tempoSemEvolucao(undefined), '—')
})
