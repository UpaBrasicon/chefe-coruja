// node --experimental-strip-types --test src/clinico/enfermagem/fugulin.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AREAS_FUGULIN, categoriaFugulin, totalFugulin } from './fugulin.ts'

const todas = (v: number) => Object.fromEntries(AREAS_FUGULIN.map((a) => [a.id, v]))

test('12 áreas, quatro graduações cada', () => {
  assert.equal(AREAS_FUGULIN.length, 12)
  assert.ok(AREAS_FUGULIN.every((a) => a.niveis.length === 4))
})

test('soma só com tudo respondido', () => {
  assert.equal(totalFugulin(todas(1)), 12)
  assert.equal(totalFugulin(todas(4)), 48)
  const falta = todas(2)
  delete falta.curativo
  assert.equal(totalFugulin(falta), null)
  assert.equal(totalFugulin({ ...todas(2), oxigenacao: 5 }), null)
})

test('categorias da versão de 12 áreas (intensivo acima de 34)', () => {
  assert.match(categoriaFugulin(12).rotulo, /mínimos/)
  assert.match(categoriaFugulin(17).rotulo, /mínimos/)
  assert.match(categoriaFugulin(18).rotulo, /intermediários/)
  assert.match(categoriaFugulin(28).rotulo, /Alta dependência/)
  assert.match(categoriaFugulin(29).rotulo, /semi-intensivos/)
  assert.match(categoriaFugulin(34).rotulo, /semi-intensivos/)
  assert.match(categoriaFugulin(35).rotulo, /intensivos \(acima/)
})
