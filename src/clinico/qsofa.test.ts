// node --experimental-strip-types --test src/clinico/qsofa.test.ts   (npm run test:clinico)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { FONTE_QSOFA, qsofa } from './qsofa.ts'

test('qSOFA: cortes de Seymour 2016 — FR 22 pontua, 21 não; PAS 100 pontua, 101 não', () => {
  assert.equal(qsofa({ fr: 22, pas: 101, consciencia: 'A' }).total, 1)
  assert.equal(qsofa({ fr: 21, pas: 101, consciencia: 'A' }).total, 0)
  assert.equal(qsofa({ fr: 21, pas: 100, consciencia: 'A' }).total, 1)
})

test('qSOFA: estado mental por Glasgow < 15 ou consciência diferente de Alerta', () => {
  assert.equal(qsofa({ fr: 18, pas: 120, glasgow: 14 }).total, 1)
  assert.equal(qsofa({ fr: 18, pas: 120, glasgow: 15 }).total, 0)
  assert.equal(qsofa({ fr: 18, pas: 120, consciencia: 'C' }).total, 1)
  assert.equal(qsofa({ fr: 18, pas: 120, consciencia: 'a' }).total, 0)
  // Glasgow 15 com "Confuso" registrado: a alteração registrada conta
  const r = qsofa({ fr: 18, pas: 120, glasgow: 15, consciencia: 'C' })
  assert.equal(r.total, 1)
  assert.equal(r.itens[1].valor, 'Confuso')
})

test('qSOFA: 2 ou mais é alerta; o texto diz que é sinal de alerta, não rastreio', () => {
  const r = qsofa({ fr: 26, pas: 95, consciencia: 'A' })
  assert.equal(r.total, 2)
  assert.equal(r.alerta, true)
  assert.match(r.texto, /^qSOFA 2 de 3 · sinal de alerta/)
  const tres = qsofa({ fr: 30, pas: 80, glasgow: 10 })
  assert.equal(tres.total, 3)
  const neg = qsofa({ fr: 18, pas: 120, consciencia: 'A' })
  assert.equal(neg.alerta, false)
  assert.match(neg.texto, /não afasta sepse/)
})

test('qSOFA: o que não foi medido não soma e marca parcial', () => {
  const r = qsofa({ fr: 24 })
  assert.equal(r.total, 1)
  assert.equal(r.parcial, true)
  assert.deepEqual(r.faltando, ['Estado mental alterado', 'PAS ≤ 100'])
  assert.match(r.texto, /^qSOFA 1\* de 3$/)
  const vazio = qsofa({})
  assert.equal(vazio.total, 0)
  assert.equal(vazio.faltando.length, 3)
  assert.equal(qsofa({ fr: Number.NaN }).itens[0].medido, false)
})

test('qSOFA: fonte citada', () => {
  assert.match(FONTE_QSOFA, /Seymour.*JAMA 2016/)
})
