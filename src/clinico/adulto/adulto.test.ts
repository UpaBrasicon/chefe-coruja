import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { INFUSOES_ADULTO, concentracao, doseAdulto, fichaInfusoesAdulto, velocidadeAdulto } from './infusoes.ts'
import { DROGAS_ISR, calcularIsr, fichaIsrAdulto } from './isr.ts'

const inf = (id: string) => INFUSOES_ADULTO.find((x) => x.id === id)!
const r1 = (x: number | null) => Math.round(x! * 10) / 10

test('adulto: fonte é o manual do HCFMUSP, e não calcula para criança', () => {
  for (const f of [fichaInfusoesAdulto, fichaIsrAdulto]) {
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('infusões: concentração final calculada do preparo bate com a do livro', () => {
  const esperado: Record<string, number> = {
    noradrenalina: 64, adrenalina: 60, dobutamina: 4000, vasopressina: 0.2, nitroprussiato: 200, nitroglicerina: 200,
    milrinona: 200, propofol: 10000, midazolam: 1, dexmedetomidina: 4, quetamina: 1, fentanil: 50, rocuronio: 10000, cisatracurio: 1000,
  }
  for (const [id, c] of Object.entries(esperado)) assert.equal(concentracao(inf(id)), c, id)
})

test('infusões: mL/h batem com as linhas corretas das tabelas do livro (70 kg)', () => {
  assert.equal(r1(velocidadeAdulto(inf('noradrenalina'), 0.1, 70)), 6.6) // tab. 15
  assert.equal(r1(velocidadeAdulto(inf('noradrenalina'), 1, 70)), 65.6)
  assert.equal(r1(velocidadeAdulto(inf('dobutamina'), 20, 70)), 21) // tab. 16
  assert.equal(r1(velocidadeAdulto(inf('propofol'), 50, 70)), 21) // tab. 8
  assert.equal(r1(velocidadeAdulto(inf('midazolam'), 0.1, 70)), 7) // tab. 9
  assert.equal(r1(velocidadeAdulto(inf('dexmedetomidina'), 1, 70)), 17.5) // tab. 10
  assert.equal(r1(velocidadeAdulto(inf('fentanil'), 0.05, 70)), 4.2) // tab. 12
  assert.equal(r1(velocidadeAdulto(inf('rocuronio'), 10, 70)), 4.2) // tab. 13
  assert.equal(r1(velocidadeAdulto(inf('nitroprussiato'), 1, 70)), 21) // tab. 17
})

test('infusões: errata — a conta não reproduz as linhas trocadas do livro', () => {
  // tab. 16 "16 µg/kg/min" traz 14,7 (que é 14 µg/kg/min); a conta dá 16,8
  assert.equal(r1(velocidadeAdulto(inf('dobutamina'), 16, 70)), 16.8)
  // tab. 14 "3 µg/kg/min" traz 10,5 (bolus); a infusão é 12,6 mL/h
  assert.equal(r1(velocidadeAdulto(inf('cisatracurio'), 3, 70)), 12.6)
  for (const id of ['noradrenalina', 'adrenalina', 'nitroglicerina', 'milrinona', 'midazolam', 'dobutamina', 'cisatracurio']) assert.ok(inf(id).errata, id)
})

test('infusões: dose fixa não depende do peso (adrenalina 1–20 µg/min = 1–20 mL/h; vasopressina 0,01–0,04 U/min = 3–12 mL/h)', () => {
  assert.equal(velocidadeAdulto(inf('adrenalina'), 1), 1)
  assert.equal(velocidadeAdulto(inf('adrenalina'), 20), 20)
  assert.equal(r1(velocidadeAdulto(inf('vasopressina'), 0.01)), 3)
  assert.equal(r1(velocidadeAdulto(inf('vasopressina'), 0.04)), 12)
})

test('infusões: caminho inverso e peso obrigatório nas drogas por kg', () => {
  assert.ok(Math.abs(doseAdulto(inf('noradrenalina'), velocidadeAdulto(inf('noradrenalina'), 0.3, 80)!, 80)! - 0.3) < 1e-9)
  assert.equal(velocidadeAdulto(inf('noradrenalina'), 0.1), null)
  assert.equal(velocidadeAdulto(inf('noradrenalina'), -1, 70), null)
})

test('ISR: volumes e ampolas batem com as tabelas 1–7 do livro', () => {
  const d = (id: string) => DROGAS_ISR.find((x) => x.id === id)!
  assert.equal(calcularIsr(d('propofol'), 70)!.volumeMl, '10,5')
  assert.equal(calcularIsr(d('midazolam'), 70)!.volumeMl, '2,8')
  assert.deepEqual([calcularIsr(d('etomidato'), 70)!.volumeMl, calcularIsr(d('etomidato'), 70)!.ampolas], ['10,5', 2])
  assert.deepEqual([calcularIsr(d('quetamina'), 70)!.volumeMl, calcularIsr(d('quetamina'), 70)!.ampolas], ['2,1', 2])
  assert.equal(calcularIsr(d('succinilcolina'), 100)!.volumeMl, '15')
  assert.deepEqual([calcularIsr(d('rocuronio'), 90)!.volumeMl, calcularIsr(d('rocuronio'), 90)!.ampolas], ['10,8', 3])
  assert.equal(calcularIsr(d('cisatracurio'), 50)!.volumeMl, '3,75')
  assert.equal(calcularIsr(d('fentanil'), 70)!.volumeMl, '1–3')
  assert.equal(calcularIsr(d('propofol'), 0), null)
})
