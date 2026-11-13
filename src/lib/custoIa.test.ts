// node --experimental-strip-types --test src/lib/custoIa.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { linhaCustoIa } from './custoIa.ts'

const base = { mes: '2026-11-01', perguntas: 12, perguntas_sem_tokens: 0, tokens_entrada_cache: 1000, tokens_entrada: 40000, tokens_saida: 9000, usd_estimado: 0.0312, modelos: ['deepseek-flash'] }

test('custo em dólar com vírgula e nota com perguntas e tokens', () => {
  const l = linhaCustoIa(base)
  assert.equal(l.medida, 'US$ 0,03')
  assert.match(l.nota, /^12 perguntas ao modelo neste mês · 50 mil tokens · estimado/)
})

test('custo menor que um centavo e perguntas sem contagem', () => {
  const l = linhaCustoIa({ ...base, perguntas: 1, perguntas_sem_tokens: 1, usd_estimado: 0.004 })
  assert.equal(l.medida, 'US$ < 0,01')
  assert.match(l.nota, /1 pergunta ao modelo/)
  assert.match(l.nota, /1 sem contagem/)
})

test('mês sem perguntas fica em zero', () => {
  const l = linhaCustoIa({ ...base, perguntas: 0, tokens_entrada_cache: 0, tokens_entrada: 0, tokens_saida: 0, usd_estimado: 0 })
  assert.equal(l.medida, 'US$ 0,00')
  assert.match(l.nota, /0 tokens/)
})
