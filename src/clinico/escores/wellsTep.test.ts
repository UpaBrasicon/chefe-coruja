// node --experimental-strip-types --test src/clinico/escores/wellsTep.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { wellsTep } from './wellsTep.ts'

const CRITERIOS = ['tvp', 'alternativo', 'fc', 'imob', 'previo', 'hemoptise', 'neoplasia']
/** Critérios presentes pelo id; os demais "Não". */
const com = (idade: number, ...ids: string[]): Respostas => ({ idade, ...Object.fromEntries(CRITERIOS.map((k) => [k, ids.includes(k) ? 1 : 0])) })

test('wells tep: sinais de TVP + FC > 100 = 4,5, provável e moderada (leituras discordam)', () => {
  const r = wellsTep.calcular(com(40, 'tvp', 'fc'))!
  assert.equal(r.valor, '4,5')
  assert.equal(r.estado, 1)
  assert.match(r.nota, /TEP PROVÁVEL/)
  assert.match(r.alerta!, /discordam/)
})
test('wells tep: todos = 12,5, alta', () => {
  const r = wellsTep.calcular(com(40, ...CRITERIOS))!
  assert.equal(r.valor, '12,5')
  assert.equal(r.estado, 2)
})
test('wells tep: cortes de três níveis (1,5→baixa, 2→moderada, 6→moderada, 6,5→alta)', () => {
  assert.equal(wellsTep.calcular(com(40, 'fc'))!.estado, 0)
  assert.equal(wellsTep.calcular(com(40, 'hemoptise', 'neoplasia'))!.estado, 1)
  assert.equal(wellsTep.calcular(com(40, 'tvp', 'alternativo'))!.estado, 1)
  assert.equal(wellsTep.calcular(com(40, 'tvp', 'alternativo', 'fc'))!.estado, 2)
})
test('wells tep: corte dicotomizado (4 improvável, 4,5 provável)', () => {
  assert.match(wellsTep.calcular(com(40, 'tvp', 'hemoptise'))!.nota, /TEP improvável/)
  assert.match(wellsTep.calcular(com(40, 'tvp', 'fc'))!.nota, /TEP PROVÁVEL/)
})
test('wells tep: D-dímero ajustado (50 anos → 500; 51 → 510; 78 → 780)', () => {
  assert.match(wellsTep.calcular(com(50))!.derivados[2][1], /^500 µg\/L · limiar fixo/)
  assert.match(wellsTep.calcular(com(51))!.derivados[2][1], /^510 µg\/L/)
  assert.match(wellsTep.calcular(com(78))!.derivados[2][1], /^780 µg\/L · 78 × 10/)
})
test('wells tep: incompleto ou idade fora da faixa devolve null', () => {
  const r = com(40)
  delete r.hemoptise
  assert.equal(wellsTep.calcular(r), null)
  assert.equal(wellsTep.calcular({ ...com(40), idade: undefined }), null)
  assert.equal(wellsTep.calcular(com(400)), null)
})
test('wells tep: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(wellsTep.ficha.publico, 'adulto')
  assert.ok(wellsTep.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(wellsTep.ficha), false)
})
