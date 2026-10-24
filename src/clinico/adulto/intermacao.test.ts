// node --experimental-strip-types --test src/clinico/adulto/intermacao.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { INTERMACAO, avaliarResfriamento, taxaParaAlvo } from './intermacao.ts'

const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9

test('intermação: números da SCCM 2025 (alvo < 39 °C, 30 min, ≥ 0,155 °C/min)', () => {
  assert.deepEqual(INTERMACAO, { definicaoC: 40, alvoC: 39, minutosAteAlvo: 30, taxaMinimaCMin: 0.155 })
})
test('intermação: de 42 °C, precisa de 0,1 °C/min para chegar a 39 em 30 min', () => {
  assert.ok(perto(taxaParaAlvo(42)!, 0.1))
  assert.equal(taxaParaAlvo(38), 0)
})
test('intermação: 42 → 40 °C em 10 min = 0,2 °C/min, suficiente; faltam 5 min no ritmo', () => {
  const r = avaliarResfriamento(42, 40, 10)!
  assert.ok(perto(r.taxaCMin, 0.2))
  assert.equal(r.taxaSuficiente, true)
  assert.equal(r.noAlvo, false)
  assert.ok(perto(r.minutosAteAlvo!, 5))
  assert.ok(perto(r.taxaNecessariaCMin!, 1 / 20))
})
test('intermação: abaixo de 39 °C está no alvo', () => {
  const r = avaliarResfriamento(41, 38.8, 12)!
  assert.equal(r.noAlvo, true)
  assert.equal(r.minutosAteAlvo, 0)
})
test('intermação: sem queda não há estimativa; taxa baixa é insuficiente', () => {
  const r = avaliarResfriamento(41, 41, 10)!
  assert.equal(r.minutosAteAlvo, null)
  assert.equal(r.taxaSuficiente, false)
})
test('intermação: medida fora da faixa ou sem tempo não calcula', () => {
  assert.equal(avaliarResfriamento(41, 40, 0), null)
  assert.equal(avaliarResfriamento(410, 40, 10), null)
})
