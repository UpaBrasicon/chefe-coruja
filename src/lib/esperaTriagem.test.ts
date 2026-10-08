// node --experimental-strip-types --test src/lib/esperaTriagem.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diasAntes, minutos, periodoDe } from './esperaTriagem.ts'

test('período: hoje, 7 e 30 dias contam o dia de hoje', () => {
  assert.deepEqual(periodoDe('hoje', '2026-10-07', '', ''), { de: '2026-10-07', ate: '2026-10-07' })
  assert.deepEqual(periodoDe('7d', '2026-10-07', '', ''), { de: '2026-10-01', ate: '2026-10-07' })
  assert.deepEqual(periodoDe('30d', '2026-10-07', '', ''), { de: '2026-09-08', ate: '2026-10-07' })
  assert.deepEqual(periodoDe('intervalo', '2026-10-07', '2026-09-01', '2026-09-15'), { de: '2026-09-01', ate: '2026-09-15' })
})

test('período: vira de mês e de ano', () => {
  assert.equal(diasAntes('2026-03-01', 1), '2026-02-28')
  assert.equal(diasAntes('2027-01-03', 6), '2026-12-28')
})

test('minutos por extenso, com vírgula', () => {
  assert.equal(minutos(null), '—')
  assert.equal(minutos(4.5), '4,5 min')
  assert.equal(minutos(8), '8 min')
  assert.equal(minutos(60), '1 h')
  assert.equal(minutos(75.4), '1 h 15 min')
})

test('alvo zero é imediato', async () => {
  const { rotuloAlvo } = await import('./esperaTriagem.ts')
  assert.equal(rotuloAlvo(0), 'imediato')
  assert.equal(rotuloAlvo(10), '10 min')
  assert.equal(rotuloAlvo(240), '4 h')
})

test('percentual inteiro, com <1% para frações pequenas', async () => {
  const { percentual } = await import('./esperaTriagem.ts')
  assert.equal(percentual(0, 0), '—')
  assert.equal(percentual(1, 3), '33%')
  assert.equal(percentual(2, 3), '67%')
  assert.equal(percentual(1, 400), '<1%')
  assert.equal(percentual(0, 10), '0%')
})
