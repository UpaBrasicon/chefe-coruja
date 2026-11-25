// node --experimental-strip-types --test src/lib/custoIa.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { lerTeto, linhaCustoIa, linhaTetoIa } from './custoIa.ts'

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

// Ajustes da revisão, item 5 (RT, 24/11/2026): teto mensal da IA
const teto = { usd: 50, definido_em: '2026-11-24T12:00:00Z', definido_por: 'Ana' }

test('teto: consumo do mês contra o teto, em dólar e em porcentagem', () => {
  const l = linhaTetoIa({ ...base, usd_estimado: 12.5 }, teto)
  assert.equal(l.medida, 'US$ 12,50 de US$ 50,00')
  assert.match(l.nota, /^25% do teto neste mês · definido por Ana/)
  assert.equal(l.selo, 'dentro')
  assert.equal(linhaTetoIa({ ...base, usd_estimado: 50 }, teto).selo, 'acima')
})

test('teto sem custo medido: mostra só o teto', () => {
  const l = linhaTetoIa(null, teto)
  assert.equal(l.medida, 'US$ 50,00')
  assert.match(l.nota, /sem dado de consumo medido/)
  assert.equal(l.selo, 'sem_medida')
})

test('teto digitado: positivo, com vírgula, até 2 casas; sem valor padrão', () => {
  assert.equal(lerTeto('50'), 50)
  assert.equal(lerTeto(' 50,5 '), 50.5)
  for (const t of ['', '0', '-3', 'abc', '1,234', '1.200,00']) assert.equal(lerTeto(t), null, t)
  const tela = readFileSync('src/pages/admin/Servidores.tsx', 'utf8')
  assert.match(tela, /rpc\('ia_teto_mensal'\)/)
  assert.match(tela, /rpc\('definir_ia_teto_mensal'/)
})
