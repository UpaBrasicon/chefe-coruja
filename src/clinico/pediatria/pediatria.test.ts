import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { BOLUS, calcularBolus, fichaBolusPediatrico } from './bolus.ts'
import { fichaViaAereaPediatrica, tuboPorIdade } from './viaAerea.ts'

const b = (id: string) => BOLUS.find((x) => x.id === id)!
const r2 = (x: number | null) => Math.round(x! * 100) / 100

test('pediatria: fonte é só o manual do HCFMUSP, declarada pediátrica', () => {
  for (const f of [fichaBolusPediatrico, fichaViaAereaPediatrica]) {
    assert.equal(temReferenciaPediatrica(f), true)
    assert.equal(f.fontes.length, 1)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência/)
    assert.doesNotMatch(JSON.stringify(f), /PedGuide|ANY App/i)
  }
  assert.doesNotMatch(JSON.stringify(BOLUS), /PedGuide|ANY App/i)
})

test('bolus: todo item tem página; ids únicos; cálculo dentro da faixa', () => {
  const ids = BOLUS.map((x) => x.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const x of BOLUS) {
    assert.ok(x.pagina, x.id)
    assert.ok(x.calcularEm >= x.faixa[0] && x.calcularEm <= x.faixa[1], x.id)
  }
})

test('Anexo 2: volumes batem com as tabelas do livro (3, 10 e 30 kg)', () => {
  assert.deepEqual([3, 10, 30].map((p) => r2(calcularBolus(b('lidocaina'), p)!.volumeMl)), [2.25, 7.5, 22.5]) // tab. 2
  assert.deepEqual([3, 10, 30].map((p) => r2(calcularBolus(b('fentanil'), p)!.volumeMl)), [1.2, 4, 12]) // tab. 3
  assert.deepEqual([3, 10, 30].map((p) => r2(calcularBolus(b('midazolam'), p)!.volumeMl)), [0.12, 0.4, 1.2]) // tab. 6
  assert.deepEqual([3, 10, 30].map((p) => r2(calcularBolus(b('diazepam'), p)!.volumeMl)), [0.18, 0.6, 1.8]) // tab. 7
  assert.deepEqual([3, 10, 30].map((p) => r2(calcularBolus(b('propofol'), p)!.volumeMl)), [0.3, 1, 3]) // tab. 8
  assert.deepEqual([3, 10, 30].map((p) => r2(calcularBolus(b('quetamina-ev'), p)!.volumeMl)), [0.06, 0.2, 0.6]) // tab. 9
  assert.deepEqual([3, 10, 30].map((p) => r2(calcularBolus(b('rocuronio'), p)!.volumeMl)), [0.36, 1.2, 3.6]) // tab. 10
  assert.deepEqual([3, 10, 30].map((p) => r2(calcularBolus(b('succinilcolina-lactente'), p)!.volumeMl)), [0.6, 2, 6]) // tab. 11
  assert.deepEqual([3, 10, 30].map((p) => r2(calcularBolus(b('etomidato'), p)!.faixaTotal[0] / 2)), [0.3, 1, 3]) // tab. 5, 0,2 mg/kg
})

test('Anexo 2 — errata: morfina não repete a tabela do fentanil; atropina respeita o mínimo', () => {
  assert.equal(r2(calcularBolus(b('morfina'), 3)!.volumeMl), 0.15)
  const at = calcularBolus(b('atropina'), 3)!
  assert.equal(at.dose, 0.1)
  assert.equal(at.noMinimo, true)
  assert.equal(r2(calcularBolus(b('atropina'), 20)!.volumeMl), 1.6) // tab. 1
  assert.equal(calcularBolus(b('atropina'), 60)!.dose, 1)
})

test('cap. 3: infusões de bloqueio em mL/h; anafilaxia e antídotos com máximo', () => {
  assert.equal(r2(calcularBolus(b('rocuronio-infusao'), 20)!.volumeMl), 6) // 0,6 mg/kg/h × 20 ÷ 2 mg/mL
  assert.equal(calcularBolus(b('metilprednisolona'), 200)!.dose, 125)
  assert.equal(calcularBolus(b('hidrocortisona'), 70)!.dose, 300)
  assert.equal(calcularBolus(b('tiossulfato'), 40)!.dose, 12500)
  assert.equal(calcularBolus(b('hidroxicobalamina'), 20)!.dose, 1400)
  assert.equal(calcularBolus(b('quetamina-ev'), 0), null)
})

test('tubo: (idade/4) + 4, arredondado a 0,5 mm; só de 1 a 13 anos', () => {
  assert.deepEqual(tuboPorIdade(4), { calculadoMm: 5, tuboMm: 5 })
  assert.deepEqual(tuboPorIdade(6), { calculadoMm: 5.5, tuboMm: 5.5 })
  assert.equal(tuboPorIdade(3)!.tuboMm, 5) // 4,75 → 5
  assert.equal(tuboPorIdade(0.5), null)
  assert.equal(tuboPorIdade(14), null)
})
