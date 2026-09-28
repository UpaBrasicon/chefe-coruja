// node --experimental-strip-types --test src/clinico/pediatria/meningitePed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  DOSES_MENINGITE, DOSES_PROFILAXIA, bms, fichaMeningitePed, leucocitosLiquorAjustados, leucocitosLiquorEstimativa, proteinaLiquorAjustada,
} from './meningitePed.ts'

const d = (id: string) => [...DOSES_MENINGITE, ...DOSES_PROFILAXIA].find((x) => x.id === id)!

test('acidente de punção (p. 409)', () => {
  assert.equal(temReferenciaPediatrica(fichaMeningitePed), true)
  // 100 leuc no LCR, 50.000 hemácias no LCR, 10.000 leuc e 5.000.000 hemácias no sangue → 100 − 100 = 0
  assert.equal(leucocitosLiquorAjustados({ leucLiquor: 100, hemLiquor: 50_000, leucSangue: 10_000, hemSangue: 5_000_000 }), 0)
  assert.equal(leucocitosLiquorAjustados({ leucLiquor: 100, hemLiquor: 1, leucSangue: 1, hemSangue: 0 }), null)
  assert.deepEqual(leucocitosLiquorEstimativa(100, 15_000), [70, 90])
  assert.equal(proteinaLiquorAjustada(80, 20_000), 60)
})

test('BMS (p. 410): muito baixo risco só com todos ausentes', () => {
  assert.deepEqual(bms(new Set()), { pontos: 0, muitoBaixoRisco: true })
  assert.deepEqual(bms(new Set(['convulsao'])), { pontos: 1, muitoBaixoRisco: false })
})

test('antibióticos (p. 410–411) com os máximos do Apêndice', () => {
  const c = calcularDoseLivro(d('ceftriaxona'), 50)!
  assert.deepEqual(c.porDose, [2000, 2000])
  assert.deepEqual(calcularDoseLivro(d('ceftriaxona'), 10)!.porDose, [500, 500])
  assert.deepEqual(calcularDoseLivro(d('cefotaxima'), 30)!.dia, [6000, 6000])
  assert.deepEqual(calcularDoseLivro(d('vancomicina'), 10)!.porDose, [150, 150])
  assert.deepEqual(calcularDoseLivro(d('ampicilina-neo'), 3)!.dia, [900, 1200])
  assert.equal(d('ampicilina-neo').neonatal, true)
  assert.equal(d('ceftriaxona').neonatal, undefined)
  assert.deepEqual(calcularDoseLivro(d('aciclovir-neo'), 3)!.porDose, [60, 60])
})

test('profilaxia (p. 412–413): rifampicina e metade no RN', () => {
  assert.deepEqual(calcularDoseLivro(d('rifampicina-mening'), 20)!.porDose, [200, 200])
  assert.deepEqual(calcularDoseLivro(d('rifampicina-mening'), 70)!.porDose, [600, 600])
  assert.deepEqual(calcularDoseLivro(d('rifampicina-mening-neo'), 3)!.porDose, [15, 15])
  assert.deepEqual(calcularDoseLivro(d('ceftriaxona-mening'), 40)!.porDose, [125, 125])
})
