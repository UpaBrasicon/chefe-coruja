// node --experimental-strip-types --test src/clinico/pediatria/fonteP4.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { calcularDoseLivro, textoDoseLivro, type DoseLivro } from './fonteP4.ts'

const base = { id: 'x', nome: 'x', unidade: 'mg', via: 'VO', pagina: 'p. 1' } as const

test('por kg/dia dividido: faixa por dose = menor total ÷ mais doses, maior ÷ menos doses', () => {
  const d: DoseLivro = { ...base, porKgDia: [50, 100], doses: [2, 4] }
  const r = calcularDoseLivro(d, 10)!
  assert.deepEqual(r.dia, [500, 1000])
  assert.deepEqual(r.porDose, [125, 500])
  assert.equal(r.noMaximo, false)
})

test('teto por dia e por dose', () => {
  const dia = calcularDoseLivro({ ...base, porKgDia: [300, 300], doses: [4, 4], maxDia: 6000 }, 30)!
  assert.deepEqual(dia.dia, [6000, 6000])
  assert.deepEqual(dia.porDose, [1500, 1500])
  assert.equal(dia.noMaximo, true)
  const dose = calcularDoseLivro({ ...base, porKgDia: [100, 100], doses: [2, 2], maxDose: 2000 }, 50)!
  assert.deepEqual(dose.porDose, [2000, 2000])
  assert.equal(dose.noMaximo, true)
})

test('por kg/dose com nº de doses e dose fixa', () => {
  const r = calcularDoseLivro({ ...base, porKgDose: [7, 7], doses: [3, 3], maxDose: 300 }, 50)!
  assert.deepEqual(r.porDose, [300, 300])
  assert.deepEqual(r.dia, [900, 900])
  const f = calcularDoseLivro({ ...base, fixo: [250, 250], doses: [2, 3] }, 12)!
  assert.deepEqual(f.porDose, [250, 250])
  assert.deepEqual(f.dia, [500, 750])
})

test('peso inválido não calcula; texto do livro', () => {
  assert.equal(calcularDoseLivro({ ...base, porKgDose: [1, 1] }, 0), null)
  assert.equal(calcularDoseLivro({ ...base, porKgDose: [1, 1] }, NaN), null)
  assert.equal(textoDoseLivro({ ...base, porKgDia: [0.3, 2.5], doses: [2, 3], maxDia: 100 }), '0,3 a 2,5 mg/kg/dia · em 2 a 3 doses/dia · máx. 100 mg/dia')
})
