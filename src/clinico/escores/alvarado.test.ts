// node --experimental-strip-types --test src/clinico/escores/alvarado.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { alvarado } from './alvarado.ts'

const com = (...ids: string[]): Respostas => Object.fromEntries(ids.map((id) => [id, true]))

test('alvarado: dor em FID + leucocitose + migração + anorexia = 6, possível', () => {
  const r = alvarado.calcular(com('dorFid', 'leucocitose', 'migracao', 'anorexia'))!
  assert.equal(r.valor, '6')
  assert.equal(r.estado, 1)
  assert.deepEqual(r.derivados[1], ['Pontos por palpação e leucocitose', '4 de 4'])
})
test('alvarado: todos marcados = 10, muito provável', () => {
  const r = alvarado.calcular(com(...alvarado.itens.map((i) => i.id)))!
  assert.equal(r.valor, '10')
  assert.match(r.derivados[0][1], /^9 a 10/)
})
test('alvarado: cortes das faixas (4→0, 5→1, 6→1, 7→2, 8→2, 9→muito provável)', () => {
  assert.equal(alvarado.calcular(com('dorFid', 'leucocitose'))!.estado, 0)
  assert.equal(alvarado.calcular(com('dorFid', 'leucocitose', 'febre'))!.estado, 1)
  assert.equal(alvarado.calcular(com('dorFid', 'leucocitose', 'febre', 'nausea'))!.estado, 1)
  assert.equal(alvarado.calcular(com('dorFid', 'leucocitose', 'febre', 'nausea', 'anorexia'))!.estado, 2)
  assert.match(alvarado.calcular(com('dorFid', 'leucocitose', 'febre', 'nausea', 'anorexia', 'migracao'))!.derivados[0][1], /^7 a 8/)
  assert.match(alvarado.calcular(com('dorFid', 'leucocitose', 'febre', 'nausea', 'anorexia', 'migracao', 'desvio'))!.derivados[0][1], /^9 a 10/)
})
test('alvarado: só marcas — sem nada marcado é 0, não null', () => {
  const r = alvarado.calcular({})!
  assert.equal(r.valor, '0')
  assert.equal(r.estado, 0)
})
test('alvarado: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(alvarado.ficha.publico, 'adulto')
  assert.ok(alvarado.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(alvarado.ficha), false)
})
