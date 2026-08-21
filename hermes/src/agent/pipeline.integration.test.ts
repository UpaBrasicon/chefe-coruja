// Teste de integração do pipeline — dedup, rate limit e fluxos completos.
// Requer: Redis em 127.0.0.1:6379 (docker) + SVC_KEY (Supabase real).
// O envio via Meta falha sem credenciais (401) — o teste verifica o que NÃO
// depende delas: dedup, rate limit, caminho não-texto e auditoria no banco.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Redis } from 'ioredis'
import { supabase } from '../lib/supabase.js'
import { jaProcessada, dentroDoRateLimit, processarMensagem } from './pipeline.js'

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
const temSupabase = Boolean(process.env.SVC_KEY)

test.after(async () => {
  // Limpa auditoria de teste criada por esta suíte.
  if (temSupabase) {
    await supabase.from('hermes_audit_log').delete().like('phone', 'teste-pipeline-%')
  }
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

// ── Fluxos completos (não dependem de creds Meta — o envio falha 401 e é logado) ──

test('não-texto — processa sem LLM e grava auditoria in/out', { skip: !disponivel || !temSupabase }, async () => {
  const waId = 'teste-pipeline-naotexto'
  await processarMensagem(redis!, `nt-${Date.now()}`, waId, '', 'outro')

  const { data } = await supabase
    .from('hermes_audit_log')
    .select('direction, tool_result_summary')
    .eq('phone', waId)
    .order('created_at', { ascending: true })
  const dirs = (data ?? []).map((r) => r.direction)
  assert.deepEqual(dirs, ['in', 'out'], `esperava in+out, veio ${JSON.stringify(dirs)}`)
  assert.match((data ?? [])[1]?.tool_result_summary ?? '', /só texto é suportado|texto/)
})

test('número não cadastrado — resposta fixa, sem LLM, auditoria in/out', { skip: !disponivel || !temSupabase }, async () => {
  const waId = 'teste-pipeline-naocad'
  await processarMensagem(redis!, `nc-${Date.now()}`, waId, 'quais meus plantões?', 'text')

  const { data } = await supabase
    .from('hermes_audit_log')
    .select('direction, tool_result_summary')
    .eq('phone', waId)
    .order('created_at', { ascending: true })
  const dirs = (data ?? []).map((r) => r.direction)
  assert.deepEqual(dirs, ['in', 'out'], `esperava in+out, veio ${JSON.stringify(dirs)}`)
  assert.match((data ?? [])[1]?.tool_result_summary ?? '', /não cadastrado/i)
})
