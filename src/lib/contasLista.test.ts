// node --experimental-strip-types --test src/lib/contasLista.test.ts
// Revisão do perfil Faturamento (CT1): caixa normal, plural certo e a ordem da lista.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { abertaHa, diasDesde, etapaNaTela, ordenarContas, pendenciasNaTela } from './contasLista.ts'

test('etapa em caixa normal', () => {
  assert.equal(etapaNaTela('aberta'), 'Aberta')
  assert.equal(etapaNaTela('em_conferencia'), 'Em conferência')
})

test('pendências com plural certo e separadas', () => {
  assert.equal(pendenciasNaTela({ bloqueantes: 3, avisos: 4 }), '3 bloqueantes · 4 avisos')
  assert.equal(pendenciasNaTela({ bloqueantes: 1, avisos: 0 }), '1 bloqueante')
  assert.equal(pendenciasNaTela({ bloqueantes: 0, avisos: 1 }), '1 aviso')
  assert.equal(pendenciasNaTela({ bloqueantes: 0, avisos: 0 }), '')
  assert.equal(pendenciasNaTela(undefined), '')
})

test('idade da conta', () => {
  const agora = Date.parse('2026-11-24T21:00:00Z')
  assert.equal(diasDesde('2026-10-21T20:00:00Z', agora), 34)
  assert.equal(abertaHa('2026-10-21T20:00:00Z', agora), 'aberta há 34 dias')
  assert.equal(abertaHa('2026-11-23T20:00:00Z', agora), 'aberta há 1 dia')
  assert.equal(abertaHa('2026-11-24T10:00:00Z', agora), 'aberta hoje')
  assert.equal(abertaHa('2026-11-25T10:00:00Z', agora), 'aberta hoje')
})

test('bloqueantes primeiro, depois a mais antiga', () => {
  const c = (id: string, aberta_em: string, bloqueantes: number, avisos = 0) => ({ id, aberta_em, pendencias: { bloqueantes, avisos } })
  const lista = [
    c('nova-sem', '2026-11-20T10:00:00Z', 0, 5),
    c('velha-sem', '2026-10-01T10:00:00Z', 0),
    c('nova-bloq', '2026-11-22T10:00:00Z', 1),
    c('velha-bloq', '2026-10-21T10:00:00Z', 3),
    { id: 'sem-resumo', aberta_em: '2026-09-01T10:00:00Z' },
  ]
  assert.deepEqual(ordenarContas(lista).map((x) => x.id), ['velha-bloq', 'nova-bloq', 'sem-resumo', 'velha-sem', 'nova-sem'])
  assert.equal(lista[0].id, 'nova-sem') // não altera a lista original
})
