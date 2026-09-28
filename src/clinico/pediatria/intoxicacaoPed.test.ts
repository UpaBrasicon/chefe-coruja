// node --experimental-strip-types --test src/clinico/pediatria/intoxicacaoPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { ANTIDOTOS_APENDICE, ANTIDOTOS_TABELA3, DOSES_CAPITULO_INTOX, TOXINDROMES, fichaIntoxicacaoPed } from './intoxicacaoPed.ts'

const d = (id: string) => DOSES_CAPITULO_INTOX.find((x) => x.id === id)!

test('ficha pediátrica do ICr; reaproveita os antídotos do Apêndice sem copiar', () => {
  assert.equal(temReferenciaPediatrica(fichaIntoxicacaoPed), true)
  assert.ok(ANTIDOTOS_APENDICE.some((b) => b.id === 'flumazenil'))
  assert.ok(ANTIDOTOS_APENDICE.every((b) => b.grupo === 'antidoto'))
  assert.equal(TOXINDROMES.length, 7)
  assert.equal(ANTIDOTOS_TABELA3.length, 22)
})

test('eliminação (p. 205): furosemida e bicarbonato por peso', () => {
  assert.deepEqual(calcularDoseLivro(d('furosemida-vo'), 12)!.porDose, [12, 36])
  assert.deepEqual(calcularDoseLivro(d('furosemida-iv'), 12)!.porDose, [6, 12])
  assert.deepEqual(calcularDoseLivro(d('bicarbonato-alcalina'), 15)!.porDose, [15, 30])
})

test('acetilcisteína VO 140 → 70 mg/kg (p. 206); atropina 0,01–0,05 (p. 206); pralidoxima IM 15 (p. 207)', () => {
  assert.deepEqual(calcularDoseLivro(d('acetilcisteina-vo-ataque'), 20)!.porDose, [2800, 2800])
  assert.deepEqual(calcularDoseLivro(d('acetilcisteina-vo-manut'), 20)!.porDose, [1400, 1400])
  assert.deepEqual(calcularDoseLivro(d('atropina-cap'), 10)!.porDose, [0.1, 0.5])
  assert.deepEqual(calcularDoseLivro(d('pralidoxima-im'), 10)!.porDose, [150, 150])
  assert.deepEqual(calcularDoseLivro(d('vitk-sc'), 10)!.porDose, [2, 5])
})
