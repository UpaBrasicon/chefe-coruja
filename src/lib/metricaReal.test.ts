import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { montarMetrica } from './metricaReal.ts'

// Item 30 do kit de desempenho (decisão do RT em 09/11/2026): o que vai ao
// Sentry por medição é só nome da métrica, valor, nota, rota sem
// identificador e papel ativo. Nada de unidade, nome, CPF, CNS ou texto.

test('leva só os cinco campos permitidos', () => {
  const m = montarMetrica({ name: 'LCP', value: 2345.67, rating: 'needs-improvement' }, '/prontuarios/3f2b8c1e-9d4a-4c7b-8e2f-1a2b3c4d5e6f?nome=Ana', 'plantonista')
  assert.deepEqual(Object.keys(m).sort(), ['metrica', 'nota', 'papel', 'rota', 'valor'])
  assert.deepEqual(m, { metrica: 'LCP', valor: '2346', nota: 'needs-improvement', rota: '/prontuarios/:id', papel: 'plantonista' })
})

test('CLS vai em milésimos, inteiro (0,123 → 123)', () => {
  assert.equal(montarMetrica({ name: 'CLS', value: 0.1234, rating: 'needs-improvement' }, '/', null).valor, '123')
})

test('papel ausente vira "—"; papel fora da lista vira "outro"', () => {
  assert.equal(montarMetrica({ name: 'TTFB', value: 80, rating: 'good' }, '/', null).papel, '—')
  assert.equal(montarMetrica({ name: 'TTFB', value: 80, rating: 'good' }, '/', 'Maria Silva').papel, 'outro')
})

test('métrica fora da lista não sai', () => {
  assert.throws(() => montarMetrica({ name: 'XYZ', value: 1, rating: 'good' }, '/', null))
})

test('o envio usa a rota sem identificador e não manda a unidade', () => {
  const sentry = readFileSync('src/lib/sentry.ts', 'utf8')
  const inicio = sentry.indexOf('export function enviarMetricaAoSentry')
  assert.ok(inicio >= 0, 'sentry.ts precisa ter enviarMetricaAoSentry')
  const trecho = sentry.slice(inicio, inicio + 900)
  assert.match(trecho, /montarMetrica\(/)
  assert.doesNotMatch(trecho, /unidade/)
})
