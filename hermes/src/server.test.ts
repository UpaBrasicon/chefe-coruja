// Teste dos endpoints HTTP via fastify.inject (sem abrir porta, sem creds reais).
// Cobre: /health (shape), handshake GET /webhook (200/403), POST assinatura
// inválida (401). O POST válido enfileira → requer Redis; coberto em
// pipeline.integration.test.ts / e2e local.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from './server.js'
import { env } from './config/env.js'

let app: Awaited<ReturnType<typeof buildApp>>

before(async () => {
  app = await buildApp()
  await app.ready()
})

after(async () => {
  await app.close()
})

test('GET /health — responde 200 com shape esperado', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' })
  assert.equal(res.statusCode, 200)
  const corpo = res.json() as { status: string; uptime: number; redis: string; supabase: string }
  assert.equal(typeof corpo.status, 'string')
  assert.equal(typeof corpo.uptime, 'number')
  assert.equal(typeof corpo.redis, 'string')
  assert.equal(typeof corpo.supabase, 'string')
  // Sem Redis local o status é degraded; com Redis+Supabase reais pode ser ok.
  assert.ok(['ok', 'degraded'].includes(corpo.status), `status inesperado: ${corpo.status}`)
})

test('GET /webhook — handshake válido retorna challenge (200)', async () => {
  const res = await app.inject({
    method: 'GET',
    url: `/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.META_VERIFY_TOKEN)}&hub.challenge=998877`,
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body, '998877')
})

test('GET /webhook — token errado retorna 403', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1',
  })
  assert.equal(res.statusCode, 403)
})

test('POST /webhook — assinatura inválida retorna 401', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/webhook',
    payload: { object: 'whatsapp_business_account' },
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': 'sha256=' + '0'.repeat(64),
    },
  })
  assert.equal(res.statusCode, 401)
})

test('POST /webhook — sem header de assinatura retorna 401', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/webhook',
    payload: { object: 'whatsapp_business_account' },
    headers: { 'content-type': 'application/json' },
  })
  assert.equal(res.statusCode, 401)
})

test('POST /webhook — assinatura válida retorna 200 rápido (enfileira, sem Redis → ok no enqueue)', async () => {
  // Assinatura correta com o META_APP_SECRET do .env de teste.
  const crypto = await import('node:crypto')
  const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
  const sig = 'sha256=' + crypto.createHmac('sha256', env.META_APP_SECRET).update(payload).digest('hex')

  const res = await app.inject({
    method: 'POST',
    url: '/webhook',
    payload,
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
  })
  assert.equal(res.statusCode, 200)
})
