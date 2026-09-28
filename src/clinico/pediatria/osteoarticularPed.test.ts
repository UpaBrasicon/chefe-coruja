// node --experimental-strip-types --test src/clinico/pediatria/osteoarticularPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { TABELA3, classificarOsteomielite, faixaOsteo, fichaOsteoarticularPed, sinovialSugestivo } from './osteoarticularPed.ts'

test('Tabela 3: doses mínimas com máximos do Apêndice (p. 498–499)', () => {
  assert.equal(temReferenciaPediatrica(fichaOsteoarticularPed), true)
  const [cef, oxa, clinda] = TABELA3.mssa90
  assert.deepEqual(calcularDoseLivro(cef, 20)!.dia, [3000, 3000])
  assert.deepEqual(calcularDoseLivro(oxa, 20)!.porDose, [1000, 1000])
  assert.deepEqual(calcularDoseLivro(clinda, 150)!.dia, [4800, 4800])
  const [vanco] = TABELA3['mrsa-clinda-25']
  assert.deepEqual(calcularDoseLivro(vanco, 60)!.dia, [2000, 2000])
  assert.deepEqual(calcularDoseLivro(TABELA3['resist-vanco-tmp'][0], 70)!.porDose, [600, 600])
})

test('faixa etária, classificação temporal e líquido sinovial', () => {
  assert.equal(faixaOsteo(2), '0-3m')
  assert.equal(faixaOsteo(3), '3m-5a')
  assert.equal(faixaOsteo(60), '3m-5a')
  assert.equal(faixaOsteo(61), '>5a')
  assert.equal(classificarOsteomielite(14), 'aguda')
  assert.equal(classificarOsteomielite(30), 'subaguda')
  assert.equal(classificarOsteomielite(120), 'crônica')
  assert.deepEqual(sinovialSugestivo(60_000, true, false), { achados: ['leucócitos > 50.000/mm³', 'predomínio de polimorfonucleares'] })
  assert.equal(sinovialSugestivo(0, false, false), null)
})
