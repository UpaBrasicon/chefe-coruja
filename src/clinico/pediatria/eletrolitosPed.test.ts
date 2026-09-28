import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ERRATA_CALCIO, FOSFORO, HIPERCALCEMIA, HIPERCALEMIA, HIPERMAGNESEMIA, HIPOCALCEMIA, HIPOMAGNESEMIA, K_IV, K_VO, calcularDose, fichaEletrolitosPed, fracaoExcrecaoMg,
  grauHipomagnesemia, hipocalcemia, mlFosforoOrganico, mlKcl191, mlSulfMg10, ofertaHipercalcemia, volumeMinimoMlH,
} from './eletrolitosPed.ts'

const d = (lista: { id: string }[], id: string) => lista.find((x) => x.id === id)! as (typeof HIPERCALEMIA)[number]
const r2 = (x: number | null | undefined) => Math.round(x! * 100) / 100

test('eletrólitos ped: ficha do ICr; toda dose tem página', () => {
  assert.equal(temReferenciaPediatrica(fichaEletrolitosPed), true)
  for (const x of [K_IV, K_VO, ...HIPERCALEMIA, ...HIPOCALCEMIA, ...HIPERCALCEMIA, ...Object.values(HIPOMAGNESEMIA), ...HIPERMAGNESEMIA, ...FOSFORO]) {
    assert.match(x.pagina, /p\. 5\d\d/, x.id)
    assert.ok(x.porKg[0] <= x.porKg[1], x.id)
  }
})

test('potássio: 0,5–1 mEq/kg/h EV; 1–4 mEq/kg/dia VO; concentração máx. 40/80 mEq/L (p. 546)', () => {
  assert.deepEqual(calcularDose(K_IV, 10)!.faixa, [5, 10])
  assert.deepEqual(calcularDose(K_VO, 10)!.faixa, [10, 40])
  assert.equal(volumeMinimoMlH(5, 'periferico'), 125)
  assert.equal(volumeMinimoMlH(5, 'central'), 62.5)
  assert.equal(mlKcl191(5), 2)
})

test('hipercalemia: Tabela 7 e texto (p. 549), com máximos', () => {
  assert.deepEqual(calcularDose(d(HIPERCALEMIA, 'gluconato-ca'), 5)!.faixa, [2.5, 10])
  const glu = calcularDose(d(HIPERCALEMIA, 'gluconato-ca'), 30)!
  assert.deepEqual(glu.faixa, [15, 20])
  assert.equal(glu.noMaximo, true)
  assert.deepEqual(calcularDose(d(HIPERCALEMIA, 'cloreto-ca'), 20)!.faixa, [4, 4]) // 20 mg/kg = 0,2 mL/kg
  assert.deepEqual(calcularDose(d(HIPERCALEMIA, 'cloreto-ca'), 60)!.faixa, [10, 10]) // 1.000 mg = 10 mL
  assert.ok(d(HIPERCALEMIA, 'cloreto-ca').errata)
  assert.deepEqual(calcularDose(d(HIPERCALEMIA, 'insulina'), 120)!.faixa, [10, 10])
  assert.deepEqual(calcularDose(d(HIPERCALEMIA, 'insulina'), 20)!.faixa, [2, 2])
  assert.deepEqual(calcularDose(d(HIPERCALEMIA, 'glicose-polarizante'), 20)!.faixa, [10, 10])
  assert.equal(calcularDose(d(HIPERCALEMIA, 'bic'), 0), null)
})

test('cálcio: cortes por faixa (p. 550), doses (p. 552–553) e errata do título da Tabela 8', () => {
  assert.equal(hipocalcemia(7.5, 'prematuro'), false)
  assert.equal(hipocalcemia(7.5, 'rnTermo'), true)
  assert.equal(hipocalcemia(8.5, 'crianca'), true)
  assert.equal(hipocalcemia(8.8, 'crianca'), false)
  assert.deepEqual(calcularDose(d(HIPOCALCEMIA, 'gluconato-rapido'), 10)!.faixa, [5, 10])
  assert.deepEqual(calcularDose(d(HIPOCALCEMIA, 'gluconato-lento'), 10)!.faixa, [20, 40])
  assert.deepEqual(calcularDose(d(HIPERCALCEMIA, 'calcitonina'), 10)!.faixa, [40, 40])
  assert.deepEqual(ofertaHipercalcemia(1000), [1500, 2000])
  assert.match(ERRATA_CALCIO[0], /hipocalemia/)
})

test('magnésio: graus, doses, máximos, FEMg (p. 556–558)', () => {
  assert.equal(grauHipomagnesemia(0.6), 'grave')
  assert.equal(grauHipomagnesemia(0.7), 'moderada')
  assert.equal(grauHipomagnesemia(1), 'moderada')
  assert.equal(grauHipomagnesemia(1.2), 'leve')
  assert.equal(grauHipomagnesemia(1.5), null)
  const g = calcularDose(HIPOMAGNESEMIA.grave, 50)!
  assert.deepEqual(g.faixa, [1250, 2000])
  assert.equal(g.noMaximo, true)
  assert.equal(mlSulfMg10(500), 5)
  assert.deepEqual(calcularDose(HIPOMAGNESEMIA.moderada, 20)!.faixa.map(r2), [6, 16])
  assert.equal(calcularDose(HIPOMAGNESEMIA.moderada, 40)!.noMaximo, true) // 32 > 24
  // FEMg = (UMg × PCr)/(0,7 × PMg × UCr) × 100
  const f = fracaoExcrecaoMg(5, 0.5, 1, 50)!
  assert.equal(r2(f.femg), 7.14)
  assert.match(f.leitura, /renal/)
  assert.match(fracaoExcrecaoMg(1, 0.5, 1, 50)!.leitura, /extrarrenal/)
  assert.deepEqual(calcularDose(d(HIPERMAGNESEMIA, 'gluconato-ca-mg'), 40)!.faixa, [3000, 3000])
})

test('fósforo: 2–3 mmol/kg/dia VO; 0,08–0,16 mmol/kg EV em 6 h; fósforo orgânico 1 mmol/mL (p. 554, 559)', () => {
  assert.deepEqual(calcularDose(d(FOSFORO, 'p-vo'), 10)!.faixa, [20, 30])
  assert.deepEqual(calcularDose(d(FOSFORO, 'p-ev'), 10)!.faixa.map(r2), [0.8, 1.6])
  assert.equal(mlFosforoOrganico(1.6), 1.6)
})
