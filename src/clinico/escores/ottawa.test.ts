// node --experimental-strip-types --test src/clinico/escores/ottawa.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Escore, Respostas } from '../escore.ts'
import { ottawaJoelho, ottawaTornozelo } from './ottawa.ts'

const com = (e: Escore, ...ids: string[]): Respostas => Object.fromEntries(e.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))

test('ottawa tornozelo: dor maleolar sem outro critério = negativa', () => {
  assert.equal(ottawaTornozelo.calcular(com(ottawaTornozelo, 'zonaMaleolar'))!.valor, 'Regra negativa')
})
test('ottawa tornozelo: dor maleolar + borda posterior da fíbula = positiva no tornozelo', () => {
  const r = ottawaTornozelo.calcular(com(ottawaTornozelo, 'zonaMaleolar', 'fibula'))!
  assert.equal(r.valor, 'Regra positiva')
  assert.deepEqual(r.derivados[0], ['Regra do tornozelo', 'positiva'])
  assert.deepEqual(r.derivados[1], ['Regra do pé (mediopé)', 'negativa'])
})
test('ottawa tornozelo: palpação sem a zona de dor não conta', () => {
  assert.equal(ottawaTornozelo.calcular(com(ottawaTornozelo, 'navicular'))!.valor, 'Regra negativa')
})
test('ottawa tornozelo: não dá 4 passos vale nas duas zonas', () => {
  assert.match(ottawaTornozelo.calcular(com(ottawaTornozelo, 'zonaMaleolar', 'zonaMediope', 'carga'))!.nota, /tornozelo e pé/)
})
test('ottawa joelho: nenhum critério = negativa; um = positiva', () => {
  assert.equal(ottawaJoelho.calcular(com(ottawaJoelho))!.valor, 'Regra negativa')
  assert.equal(ottawaJoelho.calcular(com(ottawaJoelho, 'idade55'))!.valor, 'Regra positiva')
})
test('ottawa: incompleto devolve null', () => {
  assert.equal(ottawaJoelho.calcular({ idade55: 0 }), null)
})
