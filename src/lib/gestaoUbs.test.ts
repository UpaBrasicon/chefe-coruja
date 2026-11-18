// Percurso da UBS, U13 (PR 2): contas da tela da gestão ambulatorial.
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('U13 PR 2: o período conta hoje como um dos dias', async () => {
  const { inicioDoPeriodo } = await import('../domain/gestaoUbs.ts')
  assert.equal(inicioDoPeriodo('2026-11-18', 30), '2026-10-20')
  assert.equal(inicioDoPeriodo('2026-11-18', 7), '2026-11-12')
  assert.equal(inicioDoPeriodo('2026-03-01', 1), '2026-03-01')
  // o banco recusa mais de 366 dias: 12 meses cabem
  const de = new Date(inicioDoPeriodo('2026-11-18', 365) + 'T12:00:00Z').getTime()
  assert.ok((Date.UTC(2026, 10, 18, 12) - de) / 86400000 <= 366)
})

test('U13 PR 2: proporção sem base é nula; contagem ordena e tira zeros', async () => {
  const { proporcao, ordenarContagem, minutos } = await import('../domain/gestaoUbs.ts')
  assert.equal(proporcao(1, 2), 50)
  assert.equal(proporcao(0, 0), null)
  assert.deepEqual(ordenarContagem({ a: 1, b: 0, c: 3, d: undefined }), [['c', 3], ['a', 1]])
  assert.equal(minutos(null), '—')
  assert.equal(minutos(45), '45 min')
  assert.equal(minutos(125), '2 h 05')
})
