// node --experimental-strip-types --test supabase/functions/webhooks/assinatura.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assinar, cabecalhos, enderecoSeguro, resumoErro } from './assinatura.ts'

test('assinatura: vetor de teste do Standard Webhooks', async () => {
  // https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
  const v = await assinar('whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'msg_p5jXN8AQM9LWM0D4loKWxJek', 1614265330, '{"test": 2432232314}')
  assert.equal(v, 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=')
})

test('assinatura muda com o corpo, o id e o horário', async () => {
  const s = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
  const base = await assinar(s, 'a', 1, '{}')
  assert.notEqual(await assinar(s, 'a', 1, '{ }'), base)
  assert.notEqual(await assinar(s, 'b', 1, '{}'), base)
  assert.notEqual(await assinar(s, 'a', 2, '{}'), base)
})

test('cabeçalhos da entrega', async () => {
  const h = await cabecalhos('whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'id-1', 1700000000, '{}')
  assert.equal(h['webhook-id'], 'id-1')
  assert.equal(h['webhook-timestamp'], '1700000000')
  assert.match(h['webhook-signature'], /^v1,[A-Za-z0-9+/]+=*$/)
  assert.equal(h['Content-Type'], 'application/json')
})

test('endereço seguro', () => {
  assert.ok(enderecoSeguro('https://erp.exemplo.com.br/hook?x=1'))
  assert.ok(enderecoSeguro('https://ERP.exemplo.com.br:8443/hook'))
  for (const u of ['http://erp.exemplo.com.br/hook', 'https://localhost/hook', 'https://10.0.0.5/hook', 'https://[::1]/hook',
    'https://erp.internal/hook', 'https://intranet/hook', 'https://user:senha@erp.exemplo.com.br/hook', 'não é endereço']) {
    assert.equal(enderecoSeguro(u), false, u)
  }
})

test('resumo do erro', () => {
  assert.equal(resumoErro(503, '  Service\n Unavailable '), 'HTTP 503: Service Unavailable')
  assert.equal(resumoErro(500, ''), 'HTTP 500')
  const tempo = new Error('x'); tempo.name = 'TimeoutError'
  assert.equal(resumoErro(0, null, tempo), 'Tempo esgotado (10 s)')
  assert.equal(resumoErro(0, null, new Error('dns error')), 'dns error')
  assert.equal(resumoErro(400, 'a'.repeat(500)).length, 'HTTP 400: '.length + 200)
})
