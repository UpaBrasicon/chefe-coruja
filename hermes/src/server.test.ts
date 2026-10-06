// Teste dos endpoints HTTP via fastify.inject (sem abrir porta, sem creds reais).
// Cobre: /health (shape), handshake GET /webhook (200/403), POST assinatura
// inválida (401). O POST válido enfileira → requer Redis; coberto em
// pipeline.integration.test.ts / e2e local.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp, mensagensDoPayload, MAX_IDADE_MENSAGEM_S } from './server.js'
import { env } from './config/env.js'

let app: Awaited<ReturnType<typeof buildApp>>

before(async () => {
  app = await buildApp({ crons: false }) // sem workers de cron nos testes
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

test('POST /v1/chat/completions — rota da Corujinha registrada e fechada sem token (401/503)', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/chat/completions',
    payload: { messages: [{ role: 'user', content: 'oi' }] },
  })
  // 503 se IA_GATEWAY_TOKEN não estiver no ambiente; 401 se estiver (sem Bearer)
  assert.ok([401, 503].includes(res.statusCode), `status inesperado: ${res.statusCode}`)
})

// ── Replay (Fase 0, tarefa 4 do BACKLOG.md) ──────────────────────────────────
// Webhook capturado e reenviado: a assinatura continua válida, então a defesa
// é a idade da mensagem (além do dedup de 24 h na fila).
function payloadCom(timestamp: number) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: { messages: [
      { id: 'wamid.teste', from: '5511999999999', timestamp: String(timestamp), type: 'text', text: { body: 'oi' } },
    ] } }] }],
  }
}

test('replay — mensagem recente entra na fila', () => {
  const agora = 1_800_000_000
  assert.equal(mensagensDoPayload(payloadCom(agora - 5), agora).length, 1)
})

test('replay — mensagem reenviada depois de 12 h é descartada', () => {
  const agora = 1_800_000_000
  assert.equal(mensagensDoPayload(payloadCom(agora - MAX_IDADE_MENSAGEM_S - 1), agora).length, 0)
})

test('replay — corpo alterado com a assinatura antiga retorna 401', async () => {
  const crypto = await import('node:crypto')
  const original = JSON.stringify(payloadCom(Math.floor(Date.now() / 1000)))
  const sig = 'sha256=' + crypto.createHmac('sha256', env.META_APP_SECRET).update(original).digest('hex')
  const adulterado = original.replace('"oi"', '"ola"')
  const res = await app.inject({
    method: 'POST',
    url: '/webhook',
    payload: adulterado,
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
  })
  assert.equal(res.statusCode, 401)
})

test('replay — webhook antigo com assinatura válida responde 200 e não enfileira', async () => {
  // Sem Redis no teste: se a mensagem fosse enfileirada, o addBulk falharia/travaria.
  const crypto = await import('node:crypto')
  const velho = JSON.stringify(payloadCom(Math.floor(Date.now() / 1000) - MAX_IDADE_MENSAGEM_S - 60))
  const sig = 'sha256=' + crypto.createHmac('sha256', env.META_APP_SECRET).update(velho).digest('hex')
  const res = await app.inject({
    method: 'POST',
    url: '/webhook',
    payload: velho,
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
  })
  assert.equal(res.statusCode, 200)
})
