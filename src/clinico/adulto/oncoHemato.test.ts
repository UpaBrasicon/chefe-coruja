import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { criteriosSta, fichaFalciformeAdulto, hidratacaoFalciforme, morfinaFalciforme, quetaminaFalciforme } from './falciforme.ts'
import { alopurinolSlt, cairoBishop, fichaLiseTumoralAdulto, hidratacaoSlt, produtoCalcioFosforo, rasburicaseSlt } from './liseTumoral.ts'
import { antifungicosPorPeso, fichaNeutropeniaFebrilAdulto, mascc } from './neutropeniaFebril.ts'

test('onco/hemato: fichas de adulto; MASCC cita o original para a errata', () => {
  for (const f of [mascc.ficha, fichaNeutropeniaFebrilAdulto, cairoBishop.ficha, fichaLiseTumoralAdulto, fichaFalciformeAdulto, criteriosSta.ficha]) {
    assert.equal(f.publico, 'adulto', f.id)
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
  assert.equal(mascc.ficha.fontes.length, 2)
})

const masccMax = { sintomas: 0, hipotensao: 1, dpoc: 1, tumor: 1, desidratacao: 1, ambulatorial: 1, idade: 1 }

test('MASCC: máximo 26 e corte < 21 (Tabela 2, p. 1068)', () => {
  assert.equal(mascc.calcular({ ...masccMax, idade: undefined }), null)
  assert.equal(mascc.calcular(masccMax)!.valor, '26')
  assert.equal(mascc.calcular(masccMax)!.estado, 0)
  const vinte = mascc.calcular({ ...masccMax, sintomas: 2, idade: 0, ambulatorial: 1 })! // 3+5+4+4+3+3+0 = 22
  assert.equal(vinte.valor, '22')
  assert.equal(mascc.calcular({ ...masccMax, sintomas: 2, idade: 0, ambulatorial: 0 })!.estado, 2) // 19
})

test('MASCC: sintomas graves valem 0 (errata) e o total literal do livro aparece', () => {
  const r = mascc.calcular({ ...masccMax, sintomas: 3 })!
  assert.equal(r.valor, '21')
  assert.ok(r.alerta)
  assert.match(r.derivados[1][1], /^24/)
})

test('neutropenia febril: antifúngicos por peso (p. 1072)', () => {
  assert.deepEqual(antifungicosPorPeso(60), { anfoLipossomalMg: [180, 300], voriconazolAtaqueMg: 360, voriconazolManutencaoMg: 240 })
})

test('Cairo-Bishop: laboratorial com 2, clínica com +1 (Tabela 3, p. 1102)', () => {
  assert.equal(cairoBishop.calcular({ urico: true })!.valor, 'não preenche')
  assert.equal(cairoBishop.calcular({ urico: true, fosforo: true })!.valor, 'SLT laboratorial')
  assert.equal(cairoBishop.calcular({ urico: true, fosforo: true, creatinina: true })!.valor, 'SLT clínica')
  assert.ok(cairoBishop.calcular({ urico: true, convulsao: true })!.alerta)
})

test('SLT: hidratação 2-3 L/m²/dia e diurese 100 mL/m²/h ou 2 mL/kg/h (p. 1103)', () => {
  const h = hidratacaoSlt(2, 70)!
  assert.deepEqual(h.lDia, [4, 6])
  assert.deepEqual(h.mlH.map((x) => Math.round(x)), [167, 250])
  assert.equal(h.diureseAlvoScMlH, 200)
  assert.equal(h.diureseAlvoPesoMlH, 140)
  assert.equal(hidratacaoSlt(0), null)
})

test('SLT: alopurinol por SC e por peso, teto de 800 mg e ajuste renal (p. 1103)', () => {
  const n = alopurinolSlt(1.8, 90, 'normal')
  assert.deepEqual(n.porSc, { mgDose: 180, mgDia: 540 })
  assert.deepEqual(n.porPeso, { mgDia: 800, mgTomada: 800 / 3, limitado: true })
  const ira = alopurinolSlt(2, 60, 'ira')
  assert.deepEqual(ira.porSc, { mgDose: 100, mgDia: 300 })
  assert.equal(ira.porPeso!.mgDia, 300)
  const clcr = alopurinolSlt(2, 60, 'clcr10a20')
  assert.equal(clcr.porSc, null)
  assert.match(clcr.ajusteRenal, /200 mg\/dia/)
})

test('SLT: rasburicase 0,15-0,2 mg/kg e produto Ca × P ≥ 70 (p. 1104–1105)', () => {
  assert.deepEqual(rasburicaseSlt(80), [12, 16])
  assert.deepEqual(produtoCalcioFosforo(10, 7), { produto: 70, acimaDoCorte: true })
  assert.equal(produtoCalcioFosforo(8, 8)!.acimaDoCorte, false)
})

test('falciforme: 50 mL/kg/24 h, morfina 0,15 + 0,05 mg/kg (p. 1056–1058)', () => {
  assert.deepEqual(hidratacaoFalciforme(60), { ml24h: 3000, mlH: 125 })
  assert.deepEqual(morfinaFalciforme(60), { ataqueMg: 9, repeticaoMg: 3 })
  assert.equal(morfinaFalciforme(0), null)
})

test('falciforme: quetamina — 3-5 µg/kg/min = 0,18-0,3 mg/kg/h (nota p. 1056)', () => {
  const q = quetaminaFalciforme(50)!
  assert.equal(q.inMg, 12.5)
  assert.deepEqual(q.infusaoMgH, [9, 15])
  assert.deepEqual(q.infusaoLivroMgH, [5, 15])
  assert.deepEqual(q.bolusMg, [15, 50])
  assert.equal(q.maxMgH, 50)
})

test('síndrome torácica aguda: infiltrado + ≥ 1 critério (Tabela 3, p. 1053)', () => {
  assert.equal(criteriosSta.calcular({}), null)
  assert.equal(criteriosSta.calcular({ infiltrado: 0, dor: true })!.valor, 'não preenche')
  assert.equal(criteriosSta.calcular({ infiltrado: 1 })!.valor, 'não preenche')
  assert.equal(criteriosSta.calcular({ infiltrado: 1, pao2: true })!.valor, 'preenche')
})
