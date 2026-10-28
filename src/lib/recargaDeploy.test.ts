// node --experimental-strip-types --test src/lib/recargaDeploy.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deveRecarregar, INTERVALO_RECARGA_MS } from './recargaDeploy.ts'

const agora = 1_800_000_000_000

test('sem recarga na sessão: recarrega', () => {
  assert.equal(deveRecarregar(null, agora), true)
})

test('segunda versão publicada depois do intervalo: recarrega de novo', () => {
  assert.equal(deveRecarregar(String(agora - INTERVALO_RECARGA_MS - 1), agora), true)
})

test('recarga há pouco: não recarrega (o erro é de verdade, sem laço)', () => {
  assert.equal(deveRecarregar(String(agora - 5_000), agora), false)
})

test('marca antiga da sessão ("1") ou estragada não trava a recarga', () => {
  assert.equal(deveRecarregar('1', agora), true)
  assert.equal(deveRecarregar('abc', agora), true)
})
