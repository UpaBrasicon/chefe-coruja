// node --experimental-strip-types --test src/lib/offline/regras.test.ts
// Fase 2, tarefa 7: regras do modo sem conexão (ADR 0009) — relógio do
// servidor, limite de 2 h, 20 min depois do fim do plantão, relógio do
// aparelho voltando para trás e o que conta como queda de rede.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { avaliarSemConexao, ehFalhaDeRede, horaServidor, type ContextoRelogio } from './regras.ts'

const MIN = 60_000
const T0 = Date.parse('2026-10-09T10:00:00Z')
const ctx = (o: Partial<ContextoRelogio> = {}): ContextoRelogio => ({
  servidor: T0, local: T0 - 5 * MIN, // aparelho 5 min atrasado
  fimPlantao: T0 + 4 * 60 * MIN, toleranciaMs: 20 * MIN, limiteMs: 120 * MIN, ...o,
})

test('hora do servidor: relógio monotônico com a página aberta, mesmo que mexam no relógio do aparelho', () => {
  const base = { servidor: T0, perf: 1000 }
  assert.equal(horaServidor(base, ctx(), 1000 + 30 * MIN, 0), T0 + 30 * MIN)
})

test('hora do servidor depois de recarregar: diferença do relógio do aparelho; relógio que voltou não vale', () => {
  assert.equal(horaServidor(null, ctx(), 0, T0 - 5 * MIN + 10 * MIN), T0 + 10 * MIN)
  assert.equal(horaServidor(null, ctx(), 0, T0 - 6 * MIN), null)
  assert.equal(horaServidor(null, null, 0, T0), null)
})

test('pode registrar sem conexão dentro do plantão e das 2 horas', () => {
  assert.deepEqual(avaliarSemConexao(ctx(), T0 + 60 * MIN), { pode: true })
})

test('mais de 2 horas sem conexão: papel', () => {
  const r = avaliarSemConexao(ctx(), T0 + 121 * MIN)
  assert.equal(r.pode, false)
  assert.match(!r.pode ? r.motivo : '', /2 horas/)
})

test('plantão acabou: tolerância do servidor (20 min) e fecha', () => {
  const c = ctx({ fimPlantao: T0 + 30 * MIN })
  assert.equal(avaliarSemConexao(c, T0 + 49 * MIN).pode, true)
  const r = avaliarSemConexao(c, T0 + 51 * MIN)
  assert.equal(r.pode, false)
  assert.match(!r.pode ? r.motivo : '', /20 minutos/)
})

test('sem plantão neste aparelho ou sem contato: não começa sem conexão', () => {
  assert.equal(avaliarSemConexao(ctx({ fimPlantao: null }), T0).pode, false)
  assert.equal(avaliarSemConexao(null, T0).pode, false)
  assert.equal(avaliarSemConexao(ctx(), null).pode, false)
})

test('queda de rede vai para a fila; erro do servidor não', () => {
  assert.equal(ehFalhaDeRede(false, null), true)
  assert.equal(ehFalhaDeRede(true, { message: 'TypeError: Failed to fetch' }), true)
  assert.equal(ehFalhaDeRede(true, { message: 'NetworkError when attempting to fetch resource.' }), true)
  assert.equal(ehFalhaDeRede(true, { message: 'Acesso negado.' }), false)
  assert.equal(ehFalhaDeRede(true, null), false)
})
