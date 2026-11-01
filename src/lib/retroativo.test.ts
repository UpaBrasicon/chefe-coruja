// node --experimental-strip-types --test src/lib/retroativo.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ehRetroativo, inicioDoTurno } from './retroativo.ts'

test('retroativo: o início do turno segue private.inicio_do_turno (horário de Brasília)', () => {
  assert.equal(inicioDoTurno('2026-10-28', 'manha').toISOString(), '2026-10-28T10:00:00.000Z')
  assert.equal(inicioDoTurno('2026-10-28', 'tarde').toISOString(), '2026-10-28T16:00:00.000Z')
  assert.equal(inicioDoTurno('2026-10-28', 'noite').toISOString(), '2026-10-28T22:00:00.000Z')
  assert.equal(inicioDoTurno('2026-10-28', 'madrugada').toISOString(), '2026-10-28T04:00:00.000Z')
})

test('retroativo: B3 — o plantão que já começou fica como acerto retroativo', () => {
  // gravado 28/10 noite às 04 h de 29/10 (teste ponta a ponta)
  const agora = new Date('2026-10-29T07:00:00Z').getTime()
  assert.equal(ehRetroativo('2026-10-28', 'noite', agora), true)
  assert.equal(ehRetroativo('2026-10-29', 'manha', agora), false)
  assert.equal(ehRetroativo('2026-10-30', 'noite', agora), false)
})
