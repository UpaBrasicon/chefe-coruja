// node --test scripts/auditoria-fases/scan-segredos.test.ts
// Os valores de teste são montados por concatenação para o próprio scan não
// apontar este arquivo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acharSegredos, ehEnvLocal } from './scan-segredos.ts'

const rotulos = (t: string) => acharSegredos(t).map((a) => a.rotulo)

test('formatos do projeto são reconhecidos (S10, H6)', () => {
  assert.deepEqual(rotulos('k = "' + 'cc_live_' + 'a1'.repeat(24) + '"'), ['chave da API (cc_live_/cc_test_)'])
  assert.deepEqual(rotulos('cc_test_' + '0f'.repeat(24)), ['chave da API (cc_live_/cc_test_)'])
  assert.deepEqual(rotulos('whsec_' + 'MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'), ['segredo de webhook (whsec_)'])
  assert.deepEqual(rotulos('sb_secret_' + 'N7xQ2pLm9vB4kR8tW1yZ3a'), ['chave secreta do Supabase (sb_secret_)'])
  assert.deepEqual(rotulos('RESEND_API_KEY=' + 're_' + 'Ab12Cd34' + '_' + 'Xy9Zw8Vu7Ts6Rq5Po4Nm3L'), ['chave da Resend (re_)'])
  assert.deepEqual(rotulos('$2b$' + '10$' + 'N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'), ['hash bcrypt'])
})

test('formatos antigos continuam reconhecidos', () => {
  assert.deepEqual(rotulos('sbp_' + 'a'.repeat(30)), ['token do Supabase (sbp_)'])
  assert.deepEqual(rotulos('postgresql://postgres:' + 'segredo@db.x.supabase.co'), ['senha em connection string'])
})

test('nomes comuns e placeholders não são segredo', () => {
  assert.deepEqual(rotulos('const re_avaliacao_de_risco_classificacao = 1'), [])
  assert.deepEqual(rotulos("chave.startsWith('cc_test_')"), [])
  assert.deepEqual(rotulos("'whsec_' || encode(gen_random_bytes(24), 'base64')"), [])
  assert.deepEqual(rotulos('cc_live_' + 'xyz'), [])
})

test('o trecho é mascarado', () => {
  const [a] = acharSegredos('cc_live_' + 'a1'.repeat(24))
  assert.ok(!a.mascara.includes('a1'.repeat(10)))
})

test('.env local é pulado; exemplo não', () => {
  assert.equal(ehEnvLocal('/x/.env.local'), true)
  assert.equal(ehEnvLocal('landing/.env.production'), true)
  assert.equal(ehEnvLocal('.env'), true)
  assert.equal(ehEnvLocal('landing/.env.local.example'), false)
  assert.equal(ehEnvLocal('src/env.ts'), false)
})
