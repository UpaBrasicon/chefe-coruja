import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { BOLUS, calcularBolus, fichaBolusPediatrico } from './bolus.ts'
import { cargasPorPeso, equipamentoPorPeso, fichaViaAereaPediatrica } from './viaAerea.ts'

const b = (id: string) => BOLUS.find((x) => x.id === id)!

test('pediatria: fichas declaram fonte pediátrica (calculam na criança) e são só pediátricas', () => {
  for (const f of [fichaBolusPediatrico, fichaViaAereaPediatrica]) {
    assert.equal(temReferenciaPediatrica(f), true)
    assert.equal(f.publico, 'pediatrico')
    assert.match(f.fontes[0].citacao, /PedGuide/)
  }
})

test('bolus: ids únicos, faixa coerente e cálculo dentro da faixa', () => {
  const ids = BOLUS.map((x) => x.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const x of BOLUS) {
    assert.ok(x.faixa[0] <= x.faixa[1], x.id)
    assert.ok(x.calcularEm >= x.faixa[0] && x.calcularEm <= x.faixa[1], x.id)
  }
})

test('bolus: valores do PedGuide a 20 kg', () => {
  const casos: [string, number, number | null][] = [
    ['cetamina-isr', 40, 0.8], ['midazolam-isr', 6, 1.2], ['fentanil-isr', 40, 0.8], ['propofol-isr', 50, 5],
    ['etomidato-isr', 6, 3], ['rocuronio-isr', 24, 2.4], ['succinilcolina-isr', 30, 3], ['cisatracurio-isr', 3, 1.5],
    ['epinefrina-im', 0.2, 0.2], ['glicose-10', 10, 100], ['naloxona', 2, 5], ['tranexamico', 300, 6],
    ['diazepam-se', 5, 1], ['fenitoina', 400, 8], ['levetiracetam', 1200, 12], ['manitol', 10, 50], ['salina-3', 60, 60],
    ['epinefrina-pcr', 0.2, 2], ['amiodarona-pcr', 100, 2], ['gluconato-calcio-pcr', 1200, 12], ['nac-1', 3000, 30],
    ['hidroxicobalamina', 1400, 56], ['prednisolona', 40, 40 / 3],
  ]
  for (const [id, dose, vol] of casos) {
    const r = calcularBolus(b(id), 20)!
    assert.ok(Math.abs(r.dose - dose) < 1e-9, `${id}: ${r.dose} ≠ ${dose}`)
    if (vol !== null) assert.ok(Math.abs(r.volumeMl! - vol) < 1e-9, `${id}: ${r.volumeMl} mL ≠ ${vol}`)
  }
})

test('bolus: máximo absoluto limita a dose e fica sinalizado', () => {
  const r = calcularBolus(b('diazepam-se'), 40)!
  assert.equal(r.dose, 5)
  assert.equal(r.noMaximo, true)
  assert.equal(calcularBolus(b('epinefrina-pcr'), 150)!.dose, 1)
  assert.equal(calcularBolus(b('adenosina-2'), 70)!.dose, 12)
})

test('bolus: mínimo absoluto (atropina no organofosforado, mínimo 0,1 mg)', () => {
  const r = calcularBolus(b('atropina-organofosforado'), 1)!
  assert.equal(r.dose, 0.1)
  assert.equal(r.noMinimo, true)
})

test('bolus: faixa total por peso respeita o máximo', () => {
  assert.deepEqual(calcularBolus(b('midazolam-isr'), 20)!.faixaTotal.map((x) => Math.round(x * 100) / 100), [2, 6])
  assert.deepEqual(calcularBolus(b('midazolam-isr'), 50)!.faixaTotal, [5, 10])
})

test('bolus: peso inválido não calcula', () => {
  assert.equal(calcularBolus(b('cetamina-isr'), 0), null)
  assert.equal(calcularBolus(b('cetamina-isr'), Number.NaN), null)
})

test('via aérea: cor pelas faixas da fita (não pelo deslocamento do PedGuide)', () => {
  assert.equal(equipamentoPorPeso(5)!.cor, 'Cinza')
  assert.equal(equipamentoPorPeso(6)!.cor, 'Rosa')
  assert.equal(equipamentoPorPeso(14)!.cor, 'Amarelo')
  assert.equal(equipamentoPorPeso(15)!.cor, 'Branco')
  assert.equal(equipamentoPorPeso(23)!.cor, 'Azul')
  assert.equal(equipamentoPorPeso(29)!.cor, 'Laranja')
  assert.equal(equipamentoPorPeso(30)!.cor, 'Verde')
  assert.equal(equipamentoPorPeso(18)!.tuboCuffMm, 4.5)
})

test('via aérea: fora de 3–36 kg a fita não se aplica', () => {
  assert.equal(equipamentoPorPeso(2.5), null)
  assert.equal(equipamentoPorPeso(40), null)
})

test('desfibrilação: 2 e 4 J/kg; cardioversão 0,5–1 J/kg', () => {
  assert.deepEqual(cargasPorPeso(20), { desfib1J: 40, desfib2J: 80, cardioversao: [10, 20], cardioversaoRefrataria: 40 })
  assert.equal(cargasPorPeso(0), null)
})
