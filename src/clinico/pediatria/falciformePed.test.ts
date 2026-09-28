// node --experimental-strip-types --test src/clinico/pediatria/falciformePed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { DOSES_CRISE_ALGICA, cetaminaMgH, fichaFalciformePed, intensidadeDor, paracetamolTetoDiaMg, quedaHb } from './falciformePed.ts'

const d = (id: string) => DOSES_CRISE_ALGICA.find((x) => x.id === id)!

test('intensidade da dor (Figura 1, p. 668)', () => {
  assert.equal(temReferenciaPediatrica(fichaFalciformePed), true)
  assert.equal(intensidadeDor(3), 'leve')
  assert.equal(intensidadeDor(4), 'moderada')
  assert.equal(intensidadeDor(7), 'intensa')
  assert.equal(intensidadeDor(0), null)
  assert.equal(intensidadeDor(11), null)
})

test('morfina (p. 668), dipirona (Apêndice) e cetamina 0,1–0,3 mg/kg/h', () => {
  assert.deepEqual(calcularDoseLivro(d('morfina-figura'), 20)!.porDose, [1, 1])
  const m = calcularDoseLivro(d('morfina-texto'), 20)!.porDose!
  assert.ok(Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[1] - 3) < 1e-9)
  assert.deepEqual(calcularDoseLivro(d('dipirona'), 50)!.porDose, [500, 1000])
  assert.deepEqual(cetaminaMgH(30), [3, 9])
  assert.equal(paracetamolTetoDiaMg(20), 1500)
  assert.equal(paracetamolTetoDiaMg(70), 4000)
})

test('sequestro esplênico: queda ≥ 2 g/dL (p. 670)', () => {
  assert.deepEqual(quedaHb(8, 6), { queda: 2, criterio: true })
  assert.deepEqual(quedaHb(8, 6.5), { queda: 1.5, criterio: false })
})
