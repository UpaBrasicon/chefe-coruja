// node --test scripts/biblioteca-sync.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conferirSync } from './biblioteca-sync.mjs'

const limpo = { porcelana: '', branch: 'master', head: 'abc', origem: 'abc', argv: ['node', 'x', '--confirmo-producao'] }

test('master limpo, igual ao origin/master e com a flag: passa', () => {
  assert.deepEqual(conferirSync(limpo), { ok: true })
})

test('sem --confirmo-producao é recusado', () => {
  const r = conferirSync({ ...limpo, argv: ['node', 'x', '--ingerir'] })
  assert.equal(r.ok, false)
  assert.match(r.motivo, /--confirmo-producao/)
})

test('fora do master é recusado', () => {
  const r = conferirSync({ ...limpo, branch: 'seguranca/s10-areas' })
  assert.equal(r.ok, false)
  assert.match(r.motivo, /master/)
})

test('mudança não commitada (inclusive arquivo novo) é recusada', () => {
  assert.equal(conferirSync({ ...limpo, porcelana: ' M biblioteca/app/main.py' }).ok, false)
  assert.equal(conferirSync({ ...limpo, porcelana: '?? biblioteca/corpus/novo.md' }).ok, false)
})

test('master atrás ou à frente do origin/master é recusado', () => {
  const r = conferirSync({ ...limpo, origem: 'def' })
  assert.equal(r.ok, false)
  assert.match(r.motivo, /origin\/master/)
})
