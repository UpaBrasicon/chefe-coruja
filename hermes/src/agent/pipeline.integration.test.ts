// Teste de integração do pipeline — dedup e rate limit contra Redis real.
// Requer um Redis em 127.0.0.1:6379 (docker run -p 6379:6379 redis:7-alpine).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Redis } from 'ioredis'
import { jaProcessada, dentroDoRateLimit } from './pipeline.js'

// Conexão ANTES de definir os testes (top-level await) — o `skip` da opção é
// avaliado na definição, então precisa estar pronto aqui.
let redis: Redis | null = null
try {
  const r = new Redis('redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 3_000,
    retryStrategy: () => null,
  })
  r.on('error', () => undefined)
  await r.connect()
  await r.ping()
  redis = r
  console.error('[redis-test] conectado')
} catch {
  console.error('[redis-test] Redis indisponível em 127.0.0.1:6379 — testes pulados')
}

const disponivel = redis !== null

test.after(async () => {
  redis?.disconnect()
})

test('dedup — segunda chamada com mesmo message_id retorna já-processada', { skip: !disponivel }, async () => {
  const id = `teste-dedup-${Date.now()}`
  const primeira = await jaProcessada(redis!, id)
  const segunda = await jaProcessada(redis!, id)
  assert.equal(primeira, false, 'primeira chamada processa')
  assert.equal(segunda, true, 'segunda chamada é duplicata')
})

test('dedup — message_id diferente processa normalmente', { skip: !disponivel }, async () => {
  const a = await jaProcessada(redis!, `teste-a-${Date.now()}`)
  const b = await jaProcessada(redis!, `teste-b-${Date.now()}`)
  assert.equal(a, false)
  assert.equal(b, false)
})

test('rate limit — 20 msgs permitidas, 21ª bloqueada', { skip: !disponivel }, async () => {
  const waId = `5511999999${String(Date.now()).slice(-4)}`
  for (let i = 0; i < 20; i++) {
    const ok = await dentroDoRateLimit(redis!, waId)
    assert.equal(ok, true, `msg ${i + 1} deve passar`)
  }
  const bloqueada = await dentroDoRateLimit(redis!, waId)
  assert.equal(bloqueada, false, '21ª deve ser bloqueada')
})
