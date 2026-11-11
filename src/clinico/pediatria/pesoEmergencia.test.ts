// node --experimental-strip-types --test src/clinico/pediatria/pesoEmergencia.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { temReferenciaPediatrica } from '../ficha.ts'
import { NOTA_PESO_EMERGENCIA, WELLS_PESO_2017, fichaBolusPediatrico } from './bolus.ts'
import { NOTA_PESO_DENGUE_WELLS, fichaDenguePed, pesoAproximadoMs } from './denguePed.ts'

// Escores P2/P3, item P10 (decisão B do RT, 11/11/2026).
test('peso de emergência: Wells 2017 nas duas fichas, versão nova', () => {
  assert.match(WELLS_PESO_2017.citacao, /PMID 28936627/)
  assert.equal(fichaBolusPediatrico.versao, '2026-11-11.1')
  assert.equal(fichaDenguePed.versao, '2026-11-11.1')
  assert.ok(fichaBolusPediatrico.fontes.includes(WELLS_PESO_2017))
  assert.ok(fichaDenguePed.fontes.includes(WELLS_PESO_2017))
  assert.equal(temReferenciaPediatrica(fichaBolusPediatrico), true)
})
test('peso de emergência: nota orienta pesar e não traz cálculo nem dose', () => {
  assert.match(NOTA_PESO_EMERGENCIA, /^Pese sempre/)
  assert.match(NOTA_PESO_EMERGENCIA, /69,8%/)
  assert.match(NOTA_PESO_EMERGENCIA, /55,6%/)
  assert.doesNotMatch(NOTA_PESO_EMERGENCIA, /mg|mL/)
})
test('peso de emergência: a fórmula do MS na dengue não muda; a metanálise só diverge', () => {
  assert.equal(pesoAproximadoMs(6), 7.5)
  assert.equal(pesoAproximadoMs(48), 16.5)
  assert.match(NOTA_PESO_DENGUE_WELLS, /segue o manual do MS/)
})
test('peso de emergência: as notas aparecem nas telas', () => {
  assert.match(readFileSync('src/pages/plantonista/pediatria/BolusPediatrico.tsx', 'utf8'), /NOTA_PESO_EMERGENCIA/)
  assert.match(readFileSync('src/pages/plantonista/pediatria/DenguePed.tsx', 'utf8'), /NOTA_PESO_DENGUE_WELLS/)
})
