// node --experimental-strip-types --test src/clinico/pediatria/comaHicPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { DOSES_COMA, bainhaOpticaCorte, fichaComaHicPed, gcsPupilas, ppc, ppcAlvo } from './comaHicPed.ts'

test('GCS-Pupilas (p. 374)', () => {
  assert.equal(temReferenciaPediatrica(fichaComaHicPed), true)
  assert.equal(gcsPupilas(8, 2), 6)
  assert.equal(gcsPupilas(3, 2), 1)
  assert.equal(gcsPupilas(16, 0), null)
})

test('PPC e metas por idade (p. 416, Tabela 9)', () => {
  assert.equal(ppc(70, 20), 50)
  assert.equal(ppc(0, 20), null)
  assert.deepEqual(ppcAlvo(5), [40, 50])
  assert.deepEqual(ppcAlvo(6), [50, 60])
})

test('bainha do nervo óptico (Tabela 7)', () => {
  assert.deepEqual(bainhaOpticaCorte(6, false), { corteMm: 5.2, sensEsp: '85%/76%' })
  assert.deepEqual(bainhaOpticaCorte(18, true), { corteMm: 5.2, sensEsp: '85%/76%' })
  assert.equal(bainhaOpticaCorte(12, false), 'indefinido')
  assert.deepEqual(bainhaOpticaCorte(24, false), { corteMm: 5.8, sensEsp: '86%/70%' })
})

test('doses do coma e da HIC', () => {
  const g = (id: string) => DOSES_COMA.find((d) => d.id === id)!
  assert.deepEqual(calcularDoseLivro(g('glicose25'), 10)!.porDose, [20, 40])
  assert.deepEqual(calcularDoseLivro(g('midazolam'), 60)!.porDose, [10, 10])
  const dx = calcularDoseLivro(g('dexa-hic'), 20)!
  assert.deepEqual(dx.porDose, [5, 10])
  assert.deepEqual(dx.dia, [16, 16])
})
