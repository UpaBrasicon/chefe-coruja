import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  analisarGasometria, anionGap, anionGapCorrigido, anionGapUrinario, calcularEsquemaBic, criterioLaboratorialBicarbonato, deficitBicarbonato,
  deltaDelta, fichaBicarbonato, fichaGasometria, gapOsmolar, hco3EsperadoRespiratorio, lerCloroUrinario, pco2EsperadaAlcalose, pco2EsperadaMais15,
  pco2EsperadaWinter, phArterialEstimado, phHendersonHasselbalch,
} from './acidobase.ts'

const r1 = (x: number | null | undefined) => Math.round(x! * 10) / 10
const r2 = (x: number | null | undefined) => Math.round(x! * 100) / 100

test('acidobase: fichas de adulto do manual do HC', () => {
  for (const f of [fichaGasometria, fichaBicarbonato]) {
    assert.match(f.id, /^adulto-/)
    assert.equal(f.publico, 'adulto')
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('Henderson-Hasselbalch (p. 931): HCO3 24 e pCO2 40 dão pH 7,40', () => {
  assert.equal(r2(phHendersonHasselbalch(24, 40)), 7.4)
  assert.equal(r2(phHendersonHasselbalch(12, 26)), 7.29)
  assert.equal(phHendersonHasselbalch(0, 40), null)
})

test('compensações (p. 934, 938, 942)', () => {
  assert.deepEqual(pco2EsperadaWinter(12), [24, 28]) // 1,5 × 12 + 8 = 26 ± 2
  assert.equal(pco2EsperadaMais15(12), 27)
  assert.deepEqual(pco2EsperadaAlcalose(34), [45, 49]) // 0,7 × 10 + 40 = 47 ± 2
  assert.deepEqual(hco3EsperadoRespiratorio(60, 'aguda'), [26, 26])
  assert.deepEqual(hco3EsperadoRespiratorio(60, 'cronica'), [32, 34])
  assert.deepEqual(hco3EsperadoRespiratorio(30, 'aguda'), [22, 22])
  assert.deepEqual(hco3EsperadoRespiratorio(30, 'cronica'), [19, 20])
  assert.deepEqual(hco3EsperadoRespiratorio(40, 'cronica'), [24, 24])
})

test('ânion-gap, corrigido pela albumina e delta-delta (p. 935–936)', () => {
  assert.equal(anionGap(140, 24, 104), 12)
  assert.equal(anionGapCorrigido(12, 2), 17) // + 2,5 × (4 − 2)
  assert.equal(anionGapCorrigido(12, 4), 12)
  const dd = deltaDelta(22, 12)! // ΔAG 12, ΔHCO3 12
  assert.equal(dd.razao, 1)
  assert.match(dd.texto, /1–2/)
  assert.match(deltaDelta(16, 12)!.texto, /< 1/)
  assert.match(deltaDelta(40, 12)!.texto, /> 2/)
  assert.equal(deltaDelta(20, 24), null)
})

test('AG urinário e cloro urinário (p. 936–941)', () => {
  assert.equal(anionGapUrinario(40, 30, 90)!.valor, -20)
  assert.match(anionGapUrinario(40, 30, 90)!.texto, /gastrointestinais/)
  assert.match(anionGapUrinario(60, 30, 70)!.texto, /ATR I/)
  assert.match(lerCloroUrinario(8)!.texto, /responsiva/)
  assert.match(lerCloroUrinario(40)!.texto, /resistente/)
  assert.ok(lerCloroUrinario(40)!.errata)
  assert.match(lerCloroUrinario(22)!.texto, /entre os cortes/)
})

test('gap osmolar (> 15, p. 1326) e pH venoso (p. 932)', () => {
  assert.deepEqual(gapOsmolar(320, 290), { valor: 30, acimaDe15: true })
  assert.equal(gapOsmolar(300, 290)!.acimaDe15, false)
  const [a, b] = phArterialEstimado(7.3)!
  assert.equal(r2(a), 7.32)
  assert.equal(r2(b), 7.34)
})

test('análise: acidose metabólica compensada, com acidose respiratória associada, e alcalose metabólica', () => {
  const comp = analisarGasometria({ ph: 7.29, pco2: 26, hco3: 12 })!
  assert.equal(comp.estado, 'acidemia')
  assert.deepEqual(comp.primarios, ['acidose metabólica'])
  assert.match(comp.compensacoes[0].leitura, /na faixa predita/)
  assert.equal(comp.observacoes.length, 0)
  const mista = analisarGasometria({ ph: 7.1, pco2: 38, hco3: 12 })!
  assert.match(mista.compensacoes[0].leitura, /acidose respiratória concomitante/)
  const alc = analisarGasometria({ ph: 7.5, pco2: 47, hco3: 34 })!
  assert.deepEqual(alc.primarios, ['alcalose metabólica'])
  assert.match(alc.compensacoes[0].leitura, /na faixa predita/)
})

test('análise: respiratória mostra aguda e crônica quando o tempo não é informado', () => {
  const r = analisarGasometria({ ph: 7.3, pco2: 60, hco3: 29 })!
  assert.deepEqual(r.primarios, ['acidose respiratória'])
  assert.equal(r.compensacoes.length, 2)
  assert.match(r.compensacoes[0].leitura, /alcalose metabólica/) // 29 > 26 (aguda)
  assert.match(r.compensacoes[1].leitura, /acidose metabólica/) // 29 < 32 (crônica)
  const c = analisarGasometria({ ph: 7.36, pco2: 60, hco3: 33, tempoRespiratorio: 'cronica' })!
  assert.equal(c.estado, 'pH na faixa de referência')
  assert.equal(c.compensacoes.length, 0)
  assert.equal(c.observacoes.length, 1)
  assert.equal(analisarGasometria({ ph: Number.NaN, pco2: 40, hco3: 24 }), null)
})

test('bicarbonato: déficit 0,6 × peso × (24 − HCO3), critério e esquemas (p. 937–938, 916)', () => {
  assert.equal(r1(deficitBicarbonato(70, 6)), 756)
  assert.equal(deficitBicarbonato(70, 26), 0)
  assert.equal(criterioLaboratorialBicarbonato(7.05, 6), true)
  assert.equal(criterioLaboratorialBicarbonato(7.05, 9), false)
  assert.equal(criterioLaboratorialBicarbonato(7.1, 6), false)
  const cad = calcularEsquemaBic('cad')!
  assert.deepEqual([cad.mEq, cad.volumeTotalMl, cad.concentracaoMEqL], [100, 500, 200])
  assert.deepEqual(cad.mlH, [250, 250])
  const k = calcularEsquemaBic('hipercalemia')!
  assert.equal(k.mEq, 150)
  assert.deepEqual(k.mlH, [287.5, 575])
})
