import { test } from 'node:test'
import assert from 'node:assert/strict'

import { diaDaInternacao } from './diaInternacao.ts'

// VD11 (lote "Virada de data", RT em 01/11/2026): o dia da internação vira à
// meia-noite de Brasília, não 24 h depois da admissão.

test('internado às 23h: a aferição das 8h do dia seguinte já é D+2', () => {
  assert.equal(diaDaInternacao('2026-11-02T08:00:00-03:00', '2026-11-01T23:00:00-03:00'), 'D+2')
})

test('no dia da admissão é D+1, também às 22h (já amanhã em UTC)', () => {
  assert.equal(diaDaInternacao('2026-11-01T22:00:00-03:00', '2026-11-01T08:00:00-03:00'), 'D+1')
  assert.equal(diaDaInternacao('2026-11-02T01:00:00Z', '2026-11-01T11:00:00Z'), 'D+1')
})

test('virada do ano e antes da admissão', () => {
  assert.equal(diaDaInternacao('2027-01-01T00:30:00-03:00', '2026-12-31T23:50:00-03:00'), 'D+2')
  assert.equal(diaDaInternacao('2026-10-31T23:00:00-03:00', '2026-11-01T08:00:00-03:00'), 'Adm')
})
