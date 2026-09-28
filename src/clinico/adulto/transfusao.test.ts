import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Respostas } from '../escore.ts'
import { temReferenciaPediatrica } from '../ficha.ts'
import {
  GATILHOS_HB, abcTransfusaoAdulto, bicarbonatoDoCitrato, criterioMacica, doseCcp, doseCrio, dosePfc, dosePlaquetas,
  expectativaCh, fichaTransfusaoAdulto, gatilhosAbaixo, minutosCcp, respostaPlaquetas, velocidadeCh,
} from './transfusao.ts'

test('transfusão: fichas adulto do cap. 82, sem referência pediátrica', () => {
  for (const f of [fichaTransfusaoAdulto, abcTransfusaoAdulto.ficha]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
  assert.match(fichaTransfusaoAdulto.fontes[0].citacao, /p\. 1075–1082/)
})

test('transfusão: Tabela 1 (p. 1076) — Hb 7,5 fica abaixo de 10 e 8, não de 7', () => {
  assert.deepEqual(gatilhosAbaixo(7.5), ['anemia-sintomatica', 'sca', 'dac-assintomatico', 'cirurgia-cardiaca'])
  assert.deepEqual(gatilhosAbaixo(6.9).length, 6)
  assert.deepEqual(gatilhosAbaixo(7), ['anemia-sintomatica', 'sca', 'dac-assintomatico', 'cirurgia-cardiaca'])
  assert.deepEqual(gatilhosAbaixo(Number.NaN), [])
  assert.equal(GATILHOS_HB.find((g) => g.id === 'macico')!.hb, null)
})

test('transfusão: cada CH +1 g/dL de Hb e +3% de Ht sem sangramento (p. 1075)', () => {
  assert.deepEqual(expectativaCh(6.5, 1, 20), { hb: 7.5, ht: 23 })
  assert.deepEqual(expectativaCh(6.5, 2), { hb: 8.5, ht: null })
  assert.equal(expectativaCh(6.5, 0), null)
  assert.equal(expectativaCh(6.5, 1.5), null)
})

test('transfusão: velocidade do CH — 60–120 mL/h, depois 240 mL/h; sobrecarga 1 mL/kg/h; Tabela 4 2–4 mL/kg/h', () => {
  assert.deepEqual(velocidadeCh(70), { inicialMlH: [60, 120], depoisMlH: 240, sobrecargaMlH: 70, tabela4MlH: [140, 280] })
  assert.equal(velocidadeCh().sobrecargaMlH, null)
})

test('transfusão maciça: ≈ 10 CH em 24 h ou > 4 em 1 h (p. 1077); citrato 1 mmol → 3 mEq HCO3', () => {
  assert.deepEqual(criterioMacica(10, 4), { por24h: true, por1h: false })
  assert.deepEqual(criterioMacica(3, 5), { por24h: false, por1h: true })
  assert.deepEqual(criterioMacica(), { por24h: false, por1h: false })
  assert.equal(bicarbonatoDoCitrato(10), 30)
  assert.equal(bicarbonatoDoCitrato(-1), null)
})

const abc = (...ids: string[]): Respostas => Object.fromEntries(abcTransfusaoAdulto.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))

test('ABC score: soma de 0–4 e os dois cortes do manual (≥ 2 p. 1077; > 2 p. 647)', () => {
  assert.equal(abcTransfusaoAdulto.calcular({}), null)
  const um = abcTransfusaoAdulto.calcular(abc('fast'))!
  assert.equal(um.valor, '1')
  assert.equal(um.estado, 0)
  const dois = abcTransfusaoAdulto.calcular(abc('pas', 'fc'))!
  assert.equal(dois.valor, '2')
  assert.equal(dois.estado, 1)
  assert.deepEqual(dois.derivados, [['Corte ≥ 2 (cap. 82, p. 1077)', 'atingido'], ['Corte > 2 (cap. 47, p. 647)', 'não atingido']])
  const tres = abcTransfusaoAdulto.calcular(abc('penetrante', 'pas', 'fc'))!
  assert.equal(tres.estado, 2)
  assert.equal(abcTransfusaoAdulto.calcular(abc('penetrante', 'fast', 'pas', 'fc'))!.valor, '4')
})

test('plaquetas: 1 randômica/10 kg, 6 randômicas ≈ 1 aférese, aférese 5 mL/kg (p. 1078; Tabela 4)', () => {
  assert.deepEqual(dosePlaquetas(60), { randomicas: 6, afereseEquivalente: 1, afereseMlKg: 300, sobrecargaMlH: 60 })
  assert.equal(dosePlaquetas(0), null)
  assert.deepEqual(respostaPlaquetas(8000, 25000), { incremento: 17000, acimaDe10mil: true })
  assert.deepEqual(respostaPlaquetas(8000, 18000), { incremento: 10000, acimaDe10mil: false })
})

test('PFC: 10–20 mL/kg, bolsas de 200–250 mL, 2–5 mL/kg/h, ICC 1 mL/kg/h (p. 1080); Tabela 4 10–15 e 2–4', () => {
  const d = dosePfc(70)!
  assert.deepEqual(d.ml, [700, 1400])
  assert.deepEqual(d.bolsas, [2.8, 7])
  assert.deepEqual(d.mlH, [140, 350])
  assert.equal(d.iccMlH, 70)
  assert.deepEqual(d.tabela4Ml, [700, 1050])
  assert.deepEqual(d.tabela4MlH, [140, 280])
})

test('crioprecipitado: 1 U/10 kg, 7–10 mg/dL por unidade, alvo > 100 mg/dL (p. 1080)', () => {
  const d = doseCrio(70, 60)!
  assert.equal(d.unidadesPeso, 7)
  assert.deepEqual(d.incremento, [49, 70])
  assert.deepEqual(d.fibrinogenioEsperado, [109, 130])
  // falta 40 mg/dL: 5 unidades a 10 mg/dL (50 → 110) ou 6 a 7 mg/dL (42 → 102)
  assert.deepEqual(d.unidadesParaAlvo, [5, 6])
  assert.deepEqual(doseCrio(75)!.incremento, [56, 80]) // 7,5 U → 8
  assert.deepEqual(doseCrio(70, 120)!.unidadesParaAlvo, [0, 0])
  assert.deepEqual(doseCrio(70, 100)!.unidadesParaAlvo, [1, 1])
  assert.equal(doseCrio(70, 60, 10)!.incremento[1], 100)
})

test('CCP: UI/kg por INR com teto, 100 UI/min (p. 1081); INR 4 exato cai nas duas faixas', () => {
  const [a] = doseCcp(80, 3)!
  assert.deepEqual([a.uiCalculada, a.ui, a.limitada, a.minutos], [2000, 2000, false, 20])
  const [b] = doseCcp(120, 5)!
  assert.deepEqual([b.uiCalculada, b.ui, b.limitada], [4200, 3500, true])
  const [c] = doseCcp(70, 8)!
  assert.deepEqual([c.ui, c.minutos], [3500, 35])
  assert.equal(doseCcp(70, 4)!.length, 2)
  assert.equal(doseCcp(70, 6)!.length, 1)
  assert.equal(doseCcp(70, 6)![0].uiKg, 35)
  assert.deepEqual(doseCcp(70, 1.8), [])
  assert.equal(minutosCcp(1500), 15)
})
