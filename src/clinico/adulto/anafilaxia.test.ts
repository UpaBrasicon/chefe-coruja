import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ADRENALINA_IM, SEGUNDA_LINHA_ANAFILAXIA, bolusEvMl, fichaAnafilaxiaAdulto, icatibantoMaxMg, infusaoPorMlH, infusaoPorMlMin, ugMlInfusao, volumeChoqueMl,
} from './anafilaxia.ts'

test('anafilaxia: ficha adulto do cap. 11, sem referência pediátrica', () => {
  assert.equal(fichaAnafilaxiaAdulto.publico, 'adulto')
  assert.match(fichaAnafilaxiaAdulto.id, /^adulto-[a-z0-9-]+$/)
  assert.match(fichaAnafilaxiaAdulto.fontes[0].citacao, /p\. 175–179/)
  assert.equal(temReferenciaPediatrica(fichaAnafilaxiaAdulto), false)
})

test('anafilaxia: adrenalina IM 0,3–0,5 mg = 0,3–0,5 mL de 1:1.000 (p. 175)', () => {
  assert.deepEqual(ADRENALINA_IM.mg.map((mg) => mg / ADRENALINA_IM.mgMl), [0.3, 0.5])
})

test('anafilaxia: bolus EV 0,1 mg = 1 mL de 1 mg diluído para 10 mL (p. 176)', () => {
  assert.equal(bolusEvMl(), 1)
})

test('anafilaxia: infusão 1 mg em 500 mL (2 µg/mL) a 0,5–2 mL/min = 30–120 mL/h = 1–4 µg/min (p. 176)', () => {
  assert.equal(ugMlInfusao(), 2)
  assert.deepEqual(infusaoPorMlMin(0.5), { mlMin: 0.5, mlH: 30, ugMin: 1, foraDaFaixa: false })
  assert.deepEqual(infusaoPorMlMin(2), { mlMin: 2, mlH: 120, ugMin: 4, foraDaFaixa: false })
  assert.equal(infusaoPorMlMin(3)!.foraDaFaixa, true)
  assert.deepEqual(infusaoPorMlH(60), { mlMin: 1, mlH: 60, ugMin: 2, foraDaFaixa: false })
  assert.equal(infusaoPorMlMin(-1), null)
})

test('anafilaxia: volume 10–20 mL/kg (p. 177) e icatibanto até 3 × 30 mg (p. 179)', () => {
  assert.deepEqual(volumeChoqueMl(70), [700, 1400])
  assert.equal(volumeChoqueMl(0), null)
  assert.equal(icatibantoMaxMg(), 90)
})

test('anafilaxia: segunda linha só com dose de adulto; mg/kg pediátrico fica fora', () => {
  const d = (id: string) => SEGUNDA_LINHA_ANAFILAXIA.find((x) => x.id === id)!
  assert.match(d('hidrocortisona').dose, /200 a 300 mg/)
  assert.match(d('magnesio').dose, /^2 g EV durante 20 a 30 minutos$/)
  assert.match(d('glucagon').dose, /1 mg IV a cada 5 minutos.*5 a 15 µg\/min/)
  assert.ok(d('glucagon').nota) // divergência com o cap. 15
  for (const x of SEGUNDA_LINHA_ANAFILAXIA) assert.doesNotMatch(x.dose, /mg\/kg/, x.id)
})
