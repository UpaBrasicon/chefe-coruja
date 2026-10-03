// HERMES_CRONS=0 desliga os crons do Hermes quando os vigias valem no Nous.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cronsHabilitados } from './crons.ts'

test('HERMES_CRONS ausente ou vazio = crons ligados (comportamento de sempre)', () => {
  assert.equal(cronsHabilitados(undefined), true)
  assert.equal(cronsHabilitados(''), true)
  assert.equal(cronsHabilitados('1'), true)
})

test('HERMES_CRONS=0 desliga (com ou sem espaço)', () => {
  assert.equal(cronsHabilitados('0'), false)
  assert.equal(cronsHabilitados(' 0 '), false)
})

test('valor estranho não desliga por engano (só "0" desliga)', () => {
  assert.equal(cronsHabilitados('false'), true)
  assert.equal(cronsHabilitados('00'), true)
})
