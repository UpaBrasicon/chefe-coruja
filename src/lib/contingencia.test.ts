// node --experimental-strip-types --test src/lib/contingencia.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contingenciasDoAtendimento, duracaoContingencia, type Contingencia } from './contingencia.ts'

test('duração por extenso', () => {
  assert.equal(duracaoContingencia('2026-10-08T10:00:00Z', '2026-10-08T11:35:00Z'), '1 h 35 min no papel')
  assert.equal(duracaoContingencia('2026-10-08T10:00:00Z', '2026-10-08T10:20:00Z'), '20 min no papel')
  assert.equal(duracaoContingencia('2026-10-08T10:00:00Z', '2026-10-08T12:00:00Z'), '2 h no papel')
})

test('só contingências em que o atendimento já existia (fim + 30 min)', () => {
  const c = (id: string, fim: string): Contingencia => ({
    id, inicio: '2026-10-08T08:00:00Z', fim, motivo: 'x', registrado_por: null, registrado_em: fim, reentradas: 0, atendimentos_no_periodo: 0,
  })
  const lista = [c('antiga', '2026-10-07T09:00:00Z'), c('hoje', '2026-10-08T10:00:00Z')]
  assert.deepEqual(contingenciasDoAtendimento(lista, '2026-10-08T10:20:00Z').map((x) => x.id), ['hoje'])
  assert.deepEqual(contingenciasDoAtendimento(lista, '2026-10-08T11:00:00Z').map((x) => x.id), [])
})
