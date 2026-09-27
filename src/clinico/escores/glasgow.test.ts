import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { glasgow } from './glasgow.ts'

// índices das opções: ocular 0=4 … 3=1, 4=NT; verbal 0=5 … 4=1, 5=NT; motora 0=6 … 5=1; pupilas 0,1,2
test('glasgow: 15 com pupilas reativas é trauma leve', () => {
  const r = glasgow.calcular({ ocular: 0, verbal: 0, motora: 0, pupilas: 0 })!
  assert.equal(r.valor, '15')
  assert.equal(r.estado, 0)
  assert.equal(r.derivados[0][1], 'O4 V5 M6')
})
test('glasgow: cortes 13/12 e 9/8', () => {
  assert.equal(glasgow.calcular({ ocular: 1, verbal: 1, motora: 0, pupilas: 0 })!.estado, 0) // 3+4+6=13
  assert.equal(glasgow.calcular({ ocular: 1, verbal: 2, motora: 0, pupilas: 0 })!.estado, 1) // 3+3+6=12
  assert.equal(glasgow.calcular({ ocular: 2, verbal: 3, motora: 1, pupilas: 0 })!.estado, 1) // 2+2+5=9
  assert.equal(glasgow.calcular({ ocular: 2, verbal: 3, motora: 2, pupilas: 0 })!.estado, 2) // 2+2+4=8
})
test('glasgow: GCS-P subtrai pupilas não reativas e não passa de 1', () => {
  const r = glasgow.calcular({ ocular: 3, verbal: 4, motora: 5, pupilas: 2 })!
  assert.equal(r.valor, '3')
  assert.match(r.nota, /GCS-P 1/)
  assert.ok(r.alerta?.includes('GCS-P 1'))
  assert.match(glasgow.calcular({ ocular: 0, verbal: 0, motora: 0, pupilas: 1 })!.nota, /GCS-P 14/)
})
test('glasgow: verbal não testável soma 1, registra V-NT e total com T', () => {
  const r = glasgow.calcular({ ocular: 0, verbal: 5, motora: 0, pupilas: 0 })!
  assert.equal(r.valor, '11T')
  assert.equal(r.derivados[0][1], 'O4 V-NT M6')
  assert.ok(r.alerta?.includes('não testável'))
})
test('glasgow: incompleto não calcula; escala de adulto (casco na criança)', () => {
  assert.equal(glasgow.calcular({ ocular: 0, verbal: 0 }), null)
  assert.equal(temReferenciaPediatrica(glasgow.ficha), false)
})
test('glasgow: não emite conduta', () => {
  const r = glasgow.calcular({ ocular: 3, verbal: 4, motora: 5, pupilas: 0 })!
  assert.ok(!JSON.stringify(r).match(/intubação indicada|via aérea definitiva/i))
})
