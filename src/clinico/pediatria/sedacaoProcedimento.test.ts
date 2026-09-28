// node --experimental-strip-types --test src/clinico/pediatria/sedacaoProcedimento.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ASA, REVERSORES_APENDICE, SEDATIVOS_APENDICE, cetaminaContraindicadaIdade, cetaminaTerapeuticaMg, dexmedetomidina, fichaSedacaoProcedimento, jejumFaltaH,
} from './sedacaoProcedimento.ts'

test('reaproveita os sedativos e reversores de bolus.ts', () => {
  assert.equal(temReferenciaPediatrica(fichaSedacaoProcedimento), true)
  assert.equal(SEDATIVOS_APENDICE.length, 10)
  assert.deepEqual(REVERSORES_APENDICE.map((b) => b.id).sort(), ['flumazenil', 'naloxona-maior', 'naloxona-menor'])
  assert.equal(ASA.length, 5)
})

test('cetamina 1–1,5 mg/kg e contraindicação < 3 meses (p. 848)', () => {
  assert.deepEqual(cetaminaTerapeuticaMg(20), [20, 30])
  assert.equal(cetaminaContraindicadaIdade(2), true)
  assert.equal(cetaminaContraindicadaIdade(3), false)
  assert.equal(cetaminaContraindicadaIdade(NaN), null)
})

test('dexmedetomidina: ataque 1 mcg/kg, manutenção 0,5–1 mcg/kg/h (p. 849)', () => {
  assert.deepEqual(dexmedetomidina(12), { ataqueMcg: 12, manutencaoMcgH: [6, 12] })
})

test('jejum da Tabela 4 (p. 847)', () => {
  assert.equal(jejumFaltaH('claros', 1), 1)
  assert.equal(jejumFaltaH('materno', 5), 0)
  assert.equal(jejumFaltaH('formula', 2.5), 3.5)
  assert.equal(jejumFaltaH('gordurosa', 0), 8)
  assert.equal(jejumFaltaH('claros', -1), null)
})
