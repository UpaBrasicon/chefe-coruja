// node --experimental-strip-types --test src/lib/unidadeConsumo.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rotuloUnidade } from './unidadeConsumo.ts'

test('rótulo da unidade de consumo', () => {
  assert.equal(rotuloUnidade('frasco_ampola'), 'Frasco-ampola')
  assert.equal(rotuloUnidade('outra', 'frasco conta-gotas'), 'frasco conta-gotas')
  assert.equal(rotuloUnidade(null), 'sem unidade')
})
