// node --experimental-strip-types --test src/clinico/pediatria/reanimacaoNeonatal.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { dosesReanimacao, fichaReanimacaoNeonatal, marcaCanula } from './reanimacaoNeonatal.ts'

const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9

test('reanimação: Quadro 8 (p. 32) — 3 kg: 0,6 mL IV e 3,0 mL traqueal da adrenalina diluída', () => {
  const d = dosesReanimacao(3)!
  assert.ok(perto(d.adrenalinaIvMl, 0.6))
  assert.ok(perto(d.adrenalinaTraquealMl, 3))
  assert.ok(perto(d.adrenalinaIvMg, 0.06))
  assert.ok(perto(d.adrenalinaTraquealMg, 0.3))
})
test('reanimação: Quadro 8 confere nos três pesos impressos (2, 3 e 4 kg)', () => {
  for (const [kg, iv, tq] of [[2, 0.4, 2], [3, 0.6, 3], [4, 0.8, 4]]) {
    const d = dosesReanimacao(kg)!
    assert.ok(perto(d.adrenalinaIvMl, iv) && perto(d.adrenalinaTraquealMl, tq))
  }
})
test('reanimação: SF 10 mL/kg (p. 33)', () => {
  assert.equal(dosesReanimacao(3.5)!.expansorMl, 35)
})
test('reanimação: peso fora da faixa do RN não calcula', () => {
  assert.equal(dosesReanimacao(0), null)
  assert.equal(dosesReanimacao(8), null)
})
test('reanimação: cânula pelo Quadro 4 (p. 23); com 40 semanas o peso desempata', () => {
  assert.deepEqual(marcaCanula(36).map((l) => l.cm), [8])
  assert.deepEqual(marcaCanula(40).map((l) => l.cm), [8.5, 9])
  assert.deepEqual(marcaCanula(40, 3500).map((l) => l.cm), [9])
  assert.deepEqual(marcaCanula(30), [])
})
test('reanimação: ficha pediátrica com fonte pediátrica', () => {
  assert.equal(temReferenciaPediatrica(fichaReanimacaoNeonatal), true)
})
