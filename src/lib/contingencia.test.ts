// node --experimental-strip-types --test src/lib/contingencia.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  contingenciasDoAtendimento, duracaoContingencia, faltaParaRegistrar, instanteDoCampo, ultimaContingencia, type Contingencia,
} from './contingencia.ts'

test('o campo de data e hora vale no fuso de Brasília', () => {
  assert.equal(instanteDoCampo('2026-11-24T10:30')?.toISOString(), '2026-11-24T13:30:00.000Z')
  assert.equal(instanteDoCampo(''), null)
})

test('o formulário diz o que falta para registrar', () => {
  assert.deepEqual(faltaParaRegistrar({ inicio: '', fim: '2026-11-24T10:00', motivo: '' }),
    ['a hora em que passou para o papel', 'o motivo'])
  assert.deepEqual(faltaParaRegistrar({ inicio: '2026-11-24T11:00', fim: '2026-11-24T10:00', motivo: 'queda de luz' }),
    ['o fim depois do início'])
  assert.deepEqual(faltaParaRegistrar({ inicio: '2026-11-24T09:00', fim: '2026-11-24T10:00', motivo: 'internet' }),
    ['mais 2 letras no motivo'])
  assert.deepEqual(faltaParaRegistrar({ inicio: '2026-11-24T09:00', fim: '2026-11-24T10:00', motivo: 'queda de luz' }), [])
})

test('a última contingência é a que terminou por último', () => {
  const c = (id: string, fim: string): Contingencia => ({
    id, inicio: '2026-10-08T08:00:00Z', fim, motivo: 'x', registrado_por: null, registrado_em: fim, reentradas: 0, atendimentos_no_periodo: 0,
  })
  assert.equal(ultimaContingencia([c('a', '2026-10-07T09:00:00Z'), c('b', '2026-10-09T09:00:00Z'), c('c', '2026-10-08T09:00:00Z')])?.id, 'b')
  assert.equal(ultimaContingencia([]), null)
})

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
