// node --experimental-strip-types --test src/clinico/pediatria/viasAereasSuperiores.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  DOSES_CRUPE, DOSES_FARINGITE, DOSES_OMA, DOSES_SINUSITE, GRAVIDADE_CRUPE, benzatinaFaringiteU, canulaReduzida, fichaViasAereasSuperiores,
} from './viasAereasSuperiores.ts'

const achar = (xs: typeof DOSES_OMA, id: string) => xs.find((x) => x.id === id)!

test('OMA (p. 286–287): amoxicilina 50–90 mg/kg/dia 12/12 h; cefuroxima com máx. do Apêndice', () => {
  assert.equal(temReferenciaPediatrica(fichaViasAereasSuperiores), true)
  const a = calcularDoseLivro(achar(DOSES_OMA, 'oma-amox'), 10)!
  assert.deepEqual(a.dia, [500, 900])
  assert.deepEqual(a.porDose, [250, 450])
  const c = calcularDoseLivro(achar(DOSES_OMA, 'oma-cefuroxima'), 40)!
  assert.deepEqual(c.porDose, [500, 500])
  assert.equal(c.noMaximo, true)
  assert.deepEqual(calcularDoseLivro(achar(DOSES_OMA, 'oma-amoxclav'), 50)!.dia, [4000, 4000])
})

test('faringite (Tabelas 3 e 4, p. 289–290): máximos por dose', () => {
  assert.deepEqual(calcularDoseLivro(achar(DOSES_FARINGITE, 'far-amox-1x'), 25)!.porDose, [1000, 1000])
  assert.deepEqual(calcularDoseLivro(achar(DOSES_FARINGITE, 'far-amox-1x'), 15)!.porDose, [750, 750])
  assert.deepEqual(calcularDoseLivro(achar(DOSES_FARINGITE, 'far-clinda'), 20)!.porDose, [140, 140])
  assert.deepEqual(calcularDoseLivro(achar(DOSES_FARINGITE, 'far-claritro'), 40)!.porDose, [250, 250])
  assert.equal(benzatinaFaringiteU(20), 600_000)
  assert.equal(benzatinaFaringiteU(30), 1_200_000)
  assert.equal(benzatinaFaringiteU(27), 'indefinido')
})

test('sinusite (p. 292): azitromicina 10 → 5 mg/kg/dia', () => {
  assert.deepEqual(calcularDoseLivro(achar(DOSES_SINUSITE, 'sin-azitro-d1'), 12)!.dia, [120, 120])
  assert.deepEqual(calcularDoseLivro(achar(DOSES_SINUSITE, 'sin-azitro-d2'), 12)!.dia, [60, 60])
})

test('crupe (p. 294–295): dexametasona 0,15–0,6 mg/kg máx. 10 mg; epinefrina 3–5 mL fixa; cânula 0,5 mm menor', () => {
  const [a, b] = calcularDoseLivro(achar(DOSES_CRUPE, 'crupe-dexa'), 12)!.porDose!
  assert.ok(Math.abs(a - 1.8) < 1e-9 && Math.abs(b - 7.2) < 1e-9)
  assert.deepEqual(calcularDoseLivro(achar(DOSES_CRUPE, 'crupe-dexa'), 30)!.porDose, [4.5, 10])
  assert.deepEqual(calcularDoseLivro(achar(DOSES_CRUPE, 'crupe-epinefrina'), 8)!.porDose, [3, 5])
  assert.deepEqual(canulaReduzida(4.5, 'crupe'), [4, 4])
  assert.deepEqual(canulaReduzida(5, 'supraglotite'), [4, 4.5])
  assert.equal(GRAVIDADE_CRUPE.length, 5)
})
