// node --experimental-strip-types --test src/clinico/escores/hasBled.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { hasBled } from './hasBled.ts'

const com = (...ids: string[]): Respostas => Object.fromEntries(hasBled.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))

test('has-bled: idade + AVC + álcool = 3, sangramento 3,74% ao ano', () => {
  const r = hasBled.calcular(com('idade', 'avc', 'alcool'))!
  assert.equal(r.valor, '3')
  assert.equal(r.estado, 2)
  assert.deepEqual(r.derivados[2], ['Sangramento maior por ano', '3,74%'])
})
test('has-bled: lista os fatores modificáveis presentes, sem conduta', () => {
  const r = hasBled.calcular(com('has', 'drogas', 'avc'))!
  assert.deepEqual(r.derivados[0], ['Fatores modificáveis presentes', '2 de 4'])
  assert.match(r.alerta!, /hipertensão não controlada, antiplaquetário ou AINE/)
  assert.equal(hasBled.calcular(com('avc'))!.alerta, undefined)
})
test('has-bled: faixas nos cortes (1→0, 2→1, 3→2)', () => {
  assert.equal(hasBled.calcular(com())!.estado, 0)
  assert.equal(hasBled.calcular(com('avc'))!.estado, 0)
  assert.equal(hasBled.calcular(com('avc', 'renal'))!.estado, 1)
  assert.equal(hasBled.calcular(com('avc', 'renal', 'hepatica'))!.estado, 2)
})
test('has-bled: incompleto devolve null', () => {
  const r = com()
  delete r.alcool
  assert.equal(hasBled.calcular(r), null)
})
test('has-bled: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(hasBled.ficha.publico, 'adulto')
  assert.ok(hasBled.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(hasBled.ficha), false)
})
