// node --experimental-strip-types --test src/clinico/adulto/qtc.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { qtc, qtcAdulto } from './qtc.ts'

test('qtc: com FC 60 (RR 1 s) as quatro fórmulas dão o QT medido', () => {
  const q = qtc(400, 60)!
  for (const v of Object.values(q)) assert.equal(Math.round(v), 400)
})
test('qtc: QT 400 ms e FC 120 (RR 0,5 s)', () => {
  const q = qtc(400, 120)!
  assert.equal(Math.round(q.bazett), 566) // 400 / √0,5
  assert.equal(Math.round(q.fridericia), 504) // 400 / ∛0,5
  assert.equal(Math.round(q.framingham), 477) // 400 + 154 × 0,5
  assert.equal(Math.round(q.hodges), 505) // 400 + 105 × (2 − 1)
})
test('qtc: limiares por sexo e acima de 500 ms', () => {
  assert.equal(qtcAdulto.calcular({ qt: 475, fc: 60, sexo: 1 })!.estado, 1) // homem acima de 470
  assert.equal(qtcAdulto.calcular({ qt: 475, fc: 60, sexo: 0 })!.estado, 0) // mulher até 480
  assert.equal(qtcAdulto.calcular({ qt: 510, fc: 60, sexo: 0 })!.estado, 2)
})
test('qtc: aumento de 60 ms ou mais sobre o basal é crítico', () => {
  const r = qtcAdulto.calcular({ qt: 460, fc: 60, sexo: 0, basal: 400 })!
  assert.equal(r.estado, 2)
  assert.ok(r.derivados.some(([k, v]) => k.startsWith('Aumento') && v === '+60 ms'))
})
test('qtc: com FC acima de 85 avisa que Bazett superestima', () => {
  assert.ok(qtcAdulto.calcular({ qt: 380, fc: 110, sexo: 1 })!.cuidados.some((c) => c.includes('Bazett superestima')))
})
