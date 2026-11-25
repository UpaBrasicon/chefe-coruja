import assert from 'node:assert/strict'
import { test } from 'node:test'

import { rotularSinaisVitais } from './vitaisLegiveis.ts'

test('chaves técnicas viram rótulos; valores crus, como vieram', () => {
  assert.equal(
    rotularSinaisVitais('escala-dor 1, temperatura 37.9, saturacao-o2 87, frequencia-cardiaca 108, frequencia-respiratoria 28, pressao-arterial-sistolica 138, pressao-arterial-diastolica 84'),
    'Dor 1 · Tax 37.9 · SpO₂ 87 · FC 108 · FR 28 · PA 138/84',
  )
})

test('texto escrito à mão volta igual', () => {
  const t = 'FC 104, PA 136x82, FR 26, SatO2 90% com cateter 2 L/min'
  assert.equal(rotularSinaisVitais(t), t)
  assert.equal(rotularSinaisVitais(null), '')
})

test('só uma das pressões: cada uma com o próprio rótulo; trecho livre fica', () => {
  assert.equal(rotularSinaisVitais('pressao-arterial-sistolica 90, às 14:10'), 'PAS 90 · às 14:10')
})
