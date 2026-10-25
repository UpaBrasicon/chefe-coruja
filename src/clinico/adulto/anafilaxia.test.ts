import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ADRENALINA_IM, PP_ANAFILAXIA_2023, SEGUNDA_LINHA_ANAFILAXIA, WAO_2020, adrenalinaImWaoMg, criteriosWao2020, hipotensaoWao, triptaseLimiar, bolusEvMl, fichaAnafilaxiaAdulto, icatibantoMaxMg, infusaoPorMlH, infusaoPorMlMin, ugMlInfusao, volumeChoqueMl,
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

// ── WAO 2020 e Practice Parameter 2023 (lacunas da Central, lote 3) ──

test('anafilaxia: ficha .1 com WAO 2020 e Practice Parameter 2023 depois do manual', () => {
  assert.equal(fichaAnafilaxiaAdulto.versao, '2026-10-25.1')
  assert.deepEqual(fichaAnafilaxiaAdulto.fontes.slice(1), [WAO_2020, PP_ANAFILAXIA_2023])
})
test('WAO 2020, Tabela 2: critério 1 (pele + outro) e critério 2 (alérgeno + hipotensão, broncoespasmo ou laringe)', () => {
  const nada = { pele: false, respiratorio: false, pa: false, gi: false, alergeno: false, hipotensao: false, broncoespasmo: false, laringe: false }
  assert.deepEqual(criteriosWao2020({ ...nada, pele: true, gi: true }), { provavel: true, criterio: 1 })
  assert.deepEqual(criteriosWao2020({ ...nada, alergeno: true, laringe: true }), { provavel: true, criterio: 2 })
  assert.equal(criteriosWao2020({ ...nada, pele: true }).provavel, false)
  assert.equal(criteriosWao2020({ ...nada, hipotensao: true }).provavel, false)
})
test('WAO 2020: hipotensão do adulto (PAS < 90 ou queda > 30%)', () => {
  assert.equal(hipotensaoWao(88), true)
  assert.equal(hipotensaoWao(95, 140), true)
  assert.equal(hipotensaoWao(100, 140), false)
  assert.equal(hipotensaoWao(0), null)
})
test('WAO 2020: adrenalina IM 0,01 mg/kg com teto de 0,5 mg', () => {
  assert.deepEqual(adrenalinaImWaoMg(40), { mg: 0.4, noMaximo: false })
  assert.deepEqual(adrenalinaImWaoMg(80), { mg: 0.5, noMaximo: true })
  assert.equal(adrenalinaImWaoMg(0), null)
})
test('PP 2023: limiar de triptase = 1,2 × basal + 2', () => {
  assert.equal(triptaseLimiar(5), 8)
  assert.equal(triptaseLimiar(-1), null)
})
