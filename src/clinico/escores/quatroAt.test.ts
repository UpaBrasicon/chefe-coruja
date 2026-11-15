// node --experimental-strip-types --test src/clinico/escores/quatroAt.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { quatroAt } from './quatroAt.ts'

// índices das opções: alerta 0/1 (0/4), amt4 0/1/2, meses 0/1/2, aguda 0/1 (0/4)
test('4at: tudo normal = 0, improvável', () => {
  const r = quatroAt.calcular({ alerta: 0, amt4: 0, meses: 0, aguda: 0 })!
  assert.equal(r.valor, '0')
  assert.equal(r.estado, 0)
})
test('4at: só itens cognitivos (2 + 2) = 4, possível delirium', () => {
  const r = quatroAt.calcular({ alerta: 0, amt4: 2, meses: 2, aguda: 0 })!
  assert.equal(r.valor, '4')
  assert.equal(r.estado, 2)
})
test('4at: 1 a 3 = possível comprometimento cognitivo', () => {
  const r = quatroAt.calcular({ alerta: 0, amt4: 1, meses: 1, aguda: 0 })!
  assert.equal(r.valor, '2')
  assert.match(r.nota, /comprometimento cognitivo/)
})
test('4at: alerta alterado e mudança aguda somam 4 cada (máximo 12)', () => {
  assert.equal(quatroAt.calcular({ alerta: 1, amt4: 2, meses: 2, aguda: 1 })!.valor, '12')
})

test('4AT (cap. 8): diretrizes geriátricas de PS 2025 ao lado do manual', async () => {
  const q = await import('./quatroAt.ts')
  assert.equal(q.quatroAt.ficha.versao, '2026-11-14.1')
  assert.ok(q.quatroAt.ficha.fontes.includes(q.GED_DELIRIUM_2025))
  assert.match(q.GED_DELIRIUM_2025.citacao, /PMID 41146403/)
  assert.equal(q.DIRETRIZ_DELIRIUM_2025.length, 6)
  assert.ok(q.DIRETRIZ_DELIRIUM_2025.every((d) => d.grau === 'condicional, certeza muito baixa'))
})
