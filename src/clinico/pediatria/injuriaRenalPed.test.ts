// node --experimental-strip-types --test src/clinico/pediatria/injuriaRenalPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  DOSES_IRA, K_ENZIMATICO, bicarbonatoIra, creatininaBasalEstimada, fena, fichaInjuriaRenalPed, hidratacaoContrasteMlH, kdigo, kdigoCreatinina, kdigoDiurese, leituraFena,
  relacaoUreiaCreatinina, schwartz, sobrecargaHidrica, sodioIra,
} from './injuriaRenalPed.ts'

test('KDIGO pela creatinina (Tabela 1, p. 576)', () => {
  assert.equal(temReferenciaPediatrica(fichaInjuriaRenalPed), true)
  assert.equal(kdigoCreatinina({ basal: 0.4, atual: 0.5 }), 0)
  assert.equal(kdigoCreatinina({ basal: 0.4, atual: 0.5, subiu03em48h: true }), 1)
  assert.equal(kdigoCreatinina({ basal: 0.4, atual: 0.6 }), 1)
  assert.equal(kdigoCreatinina({ basal: 0.4, atual: 0.8 }), 2)
  assert.equal(kdigoCreatinina({ basal: 0.4, atual: 1.2 }), 2)
  assert.equal(kdigoCreatinina({ basal: 0.4, atual: 1.3 }), 3)
  assert.equal(kdigoCreatinina({ basal: 0, atual: 0, tfg: 30 }), 3)
  assert.equal(kdigoCreatinina({ basal: 0, atual: 0 }), null)
})

test('KDIGO pela diurese e o pior dos dois', () => {
  assert.equal(kdigoDiurese(0.4, 5), 0)
  assert.equal(kdigoDiurese(0.4, 6), 1)
  assert.equal(kdigoDiurese(0.4, 13), 2)
  assert.equal(kdigoDiurese(0.2, 25), 3)
  assert.equal(kdigoDiurese(0, 13), 3)
  assert.equal(kdigo(1, 2), 2)
  assert.equal(kdigo(null, null), null)
})

test('Schwartz, creatinina basal estimada, FeNa, U/Cr (p. 576–582)', () => {
  assert.ok(Math.abs(schwartz(100, 0.5, K_ENZIMATICO)! - 82.6) < 1e-9)
  assert.ok(Math.abs(schwartz(100, 0.5, 0.55)! - 110) < 1e-9)
  assert.ok(Math.abs(creatininaBasalEstimada(120, K_ENZIMATICO)! - 0.413) < 1e-9)
  assert.equal(fena({ naU: 20, crS: 1, naS: 140, crU: 100 })!.toFixed(4), '0.1429')
  assert.match(leituraFena(0.5, false)!, /funcional/)
  assert.match(leituraFena(2.2, true)!, /entre/)
  assert.equal(relacaoUreiaCreatinina(80, 1), 80)
})

test('sobrecarga hídrica (p. 585) e doses', () => {
  assert.equal(sobrecargaHidrica(3, 1, 20), 10)
  assert.equal(sobrecargaHidrica(3, 1, 0), null)
  assert.deepEqual(hidratacaoContrasteMlH(10), [10, 30])
  const nac = calcularDoseLivro(DOSES_IRA.find((d) => d.id === 'nac-contraste')!, 40)!
  assert.deepEqual(nac.porDose, [1200, 1200])
  assert.equal(nac.noMaximo, true)
  assert.deepEqual(sodioIra(10, 120), { meq: 60, mlNaCl3: 120 })
  assert.equal(bicarbonatoIra(10, 10), 15)
})
