import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ERRATA_ALCALOSE_METABOLICA, ERRATA_BIC14, anionGap, bicarbonatoMeq, criterioBicarbonato, fichaAcidoBasePed, hclMeq, hco3EsperadoRespiratorio, lerGasometria,
  mlBic14, mlHcl, pco2EsperadaAcidoseMetabolica, razaoDelta,
} from './acidobasePed.ts'

const r1 = (x: number | null | undefined) => Math.round(x! * 10) / 10

test('acidobásico: ficha do ICr (cap. 55)', () => {
  assert.equal(temReferenciaPediatrica(fichaAcidoBasePed), true)
  assert.match(fichaAcidoBasePed.fontes[0].citacao, /cap\. 55, p\. 561–573/)
})

test('Tabela 3: acidose metabólica pCO2 = 1,5 × HCO3 + 8 ± 2; respiratórias 0,1/0,4 e 0,2/0,5 (p. 563)', () => {
  assert.deepEqual(pco2EsperadaAcidoseMetabolica(10), [21, 25])
  assert.equal(hco3EsperadoRespiratorio(60, 'aguda'), 27)
  assert.equal(hco3EsperadoRespiratorio(60, 'cronica'), 33)
  assert.equal(hco3EsperadoRespiratorio(30, 'aguda'), 23)
  assert.equal(hco3EsperadoRespiratorio(30, 'cronica'), 20)
  assert.match(ERRATA_ALCALOSE_METABOLICA, /± 9/)
})

test('leitura: acidose metabólica compensada, mista e pH normal com alteração', () => {
  const a = lerGasometria(7.25, 23, 10)!
  assert.equal(a.estado, 'acidemia')
  assert.deepEqual(a.primarios, ['acidose metabólica'])
  assert.equal(a.compensacao!.dentro, true)
  const b = lerGasometria(7.1, 35, 10)!
  assert.equal(b.compensacao!.dentro, false)
  assert.match(b.compensacao!.texto, /acidose respiratória/)
  const m = lerGasometria(7.1, 55, 15)!
  assert.deepEqual(m.primarios, ['acidose metabólica', 'acidose respiratória'])
  assert.ok(m.alertas.length)
  const n = lerGasometria(7.4, 25, 15)!
  assert.equal(n.estado, 'pH normal')
  assert.ok(n.alertas.length)
  const alc = lerGasometria(7.5, 45, 34)!
  assert.deepEqual(alc.primarios, ['alcalose metabólica'])
  assert.equal(alc.compensacao!.dentro, null)
})

test('ânion-gap e razão delta (p. 564 e 571)', () => {
  assert.equal(anionGap(140, 104, 10), 26)
  const r = razaoDelta(26, 10, 12)! // ΔAG 14 / ΔHCO3 15 = 0,93
  assert.equal(r1(r.razao), 0.9)
  assert.match(r.texto, /entre 0,8 e 1,2/)
  assert.match(razaoDelta(14, 10, 12)!.texto, /< 0,8/)
  assert.equal(razaoDelta(20, 26, 12), null)
})

test('bicarbonato: indicação pH < 7,1 ou HCO3 < 8; (15 − HCO3) × 0,3 × P; 1,4% = 0,17 mEq/mL (p. 566)', () => {
  assert.equal(criterioBicarbonato(7.05, 10), true)
  assert.equal(criterioBicarbonato(7.2, 7), true)
  assert.equal(criterioBicarbonato(7.2, 10), false)
  assert.equal(bicarbonatoMeq(10, 5), 30)
  assert.equal(bicarbonatoMeq(10, 15), null)
  assert.equal(Math.round(mlBic14(30)!), 176)
  assert.match(ERRATA_BIC14, /mEq por mL/)
})

test('HCl na alcalose grave: 0,5 × P × (HCO3 − desejado); máx. 0,2 mEq/kg/h; metade primeiro (p. 567–568)', () => {
  const h = hclMeq(10, 45, 35)!
  assert.equal(h.total, 50)
  assert.equal(h.metade, 25)
  assert.equal(h.maxMeqH, 2)
  assert.equal(h.horasMin, 12.5)
  assert.equal(mlHcl(25, 100), 250)
  assert.equal(hclMeq(10, 30, 35), null)
})
