// node --experimental-strip-types --test src/clinico/pediatria/anafilaxia.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { DOSES_ANAFILAXIA, epinefrinaDoseFixa, fenoterolGotas, fichaAnafilaxiaPediatrica } from './anafilaxia.ts'
import { DIAS_ANO, calcularDose } from './fonteP2.ts'

const d = (id: string) => DOSES_ANAFILAXIA.find((x) => x.id === id)!

test('anafilaxia: ficha pediátrica do ICr', () => {
  assert.equal(temReferenciaPediatrica(fichaAnafilaxiaPediatrica), true)
  assert.equal(new Set(DOSES_ANAFILAXIA.map((x) => x.id)).size, DOSES_ANAFILAXIA.length)
})

test('epinefrina IM 0,01 mg/kg, máx. 0,5 mg; 0,01 mL/kg de 1:1.000 (p. 98, 101)', () => {
  const e = calcularDose(d('epinefrina-im'), 15)!
  assert.deepEqual(e.dose, [0.15, 0.15])
  assert.deepEqual(e.volumeMl, [0.15, 0.15])
  const g = calcularDose(d('epinefrina-im'), 60)!
  assert.deepEqual(g.dose, [0.5, 0.5])
  assert.equal(g.noMaximo, true)
  const iv = calcularDose(d('epinefrina-iv'), 20)!
  assert.deepEqual(iv.volumeMl, [2, 2]) // 0,1 mL/kg de 1:10.000
})

test('dose fixa por idade (p. 98): faixas e ambiguidade aos 6 e 12 anos', () => {
  assert.deepEqual(epinefrinaDoseFixa(90)!.doses, ['0,1 a 0,15 mg'])
  assert.deepEqual(epinefrinaDoseFixa(2 * DIAS_ANO)!.doses, ['0,15 mg'])
  assert.equal(epinefrinaDoseFixa(6 * DIAS_ANO + 10)!.ambigua, true)
  assert.deepEqual(epinefrinaDoseFixa(9 * DIAS_ANO)!.doses, ['0,3 mg'])
  assert.deepEqual(epinefrinaDoseFixa(12 * DIAS_ANO + 10)!.doses, ['0,3 mg', '0,5 mg'])
  assert.deepEqual(epinefrinaDoseFixa(13 * DIAS_ANO)!.doses, ['0,5 mg'])
})

test('segunda e terceira linha (Tabela 3, p. 101–102)', () => {
  assert.deepEqual(calcularDose(d('cristaloide'), 10)!.dose, [100, 200])
  assert.deepEqual(fenoterolGotas(12), { gotas: 4, mg: 1, noMaximo: false })
  assert.deepEqual(fenoterolGotas(45), { gotas: 10, mg: 2.5, noMaximo: true })
  assert.deepEqual(calcularDose(d('difenidramina-texto'), 40)!.dose, [40, 50]) // máx. 50 mg (texto)
  assert.deepEqual(calcularDose(d('difenidramina-tabela'), 40)!.dose, [20, 40])
  assert.deepEqual(calcularDose(d('glucagon'), 40)!.dose, [800, 1000]) // máx. 1 mg
  assert.deepEqual(calcularDose(d('norepinefrina'), 10)!.dose, [0.5, 20])
  assert.ok(d('metilprednisolona').nota)
})
