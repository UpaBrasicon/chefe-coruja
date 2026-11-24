import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// assinador.ts importa o cliente do Supabase; as funções puras são testadas por
// cópia do comportamento esperado e conferidas no arquivo (sem rede).
const fonte = readFileSync(new URL('./assinador.ts', import.meta.url), 'utf8')
const puro = readFileSync(new URL('./assinadorPuro.ts', import.meta.url), 'utf8')
const servico = readFileSync(new URL('../../services/assinador/src/fluxo.ts', import.meta.url), 'utf8')

test('LG7: os tipos assinados no app são os mesmos do assinador (decisão A1)', () => {
  const doApp = [...(/TIPOS_ASSINAVEIS = new Set\(\[([^\]]+)\]\)/.exec(puro)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
  const bloco = /const TIPO_SAUDE[^{]*\{([^}]+)\}/.exec(servico)?.[1] ?? ''
  const doServico = [...bloco.matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]).sort()
  assert.ok(doApp.length > 0)
  assert.deepEqual(doApp, doServico)
  assert.ok(!doApp.includes('evolucao') && !doApp.includes('prescricao'), 'evolução e prescrição do internado ficam com o login e o 2FA')
})

test('LG7: desligada sem VITE_ASSINADOR_URL e a emissão nunca espera pela assinatura', () => {
  assert.match(fonte, /assinaturaLigada = \(\) => URL_ASSINADOR\.length > 0/)
  assert.match(fonte, /if \(!assinaturaLigada\(\) \|\| !TIPOS_ASSINAVEIS\.has\(doc\.tipo\)\) return 'nao-se-aplica'/)
  // quem emite chama assinarSeDer sem await (não trava a impressão)
  const prontuario = readFileSync(new URL('./prontuario.ts', import.meta.url), 'utf8')
  assert.match(prontuario, /void assinarSeDer\(/)
})

test('LG7: bytea do PostgREST vira bytes', async () => {
  const { bytesDoBytea } = await import('./assinadorPuro.ts')
  assert.deepEqual([...bytesDoBytea('\\x255044462d')], [0x25, 0x50, 0x44, 0x46, 0x2d])
})

test('LG7: texto da sessão', async () => {
  const { textoDaSessao } = await import('./assinadorPuro.ts')
  assert.match(textoDaSessao(undefined), /Sem sessão de assinatura/)
  assert.match(textoDaSessao({ ativa: true, valida_ate: '2026-11-18T22:00:00Z' }, new Date('2026-11-18T15:00:00Z')), /ativa até as 19:00/)
  assert.match(textoDaSessao({ ativa: true, valida_ate: '2026-11-18T10:00:00Z' }, new Date('2026-11-18T15:00:00Z')), /terminou/)
})

// Pedido 18 (F7): o navegador não espera o assinador para sempre.
test('LG7: assinador travado: erro 504 com texto claro no prazo, sem nova tentativa', async () => {
  const { pedirAoAssinador, ASSINADOR_SEM_RESPOSTA } = await import('./assinadorPuro.ts')
  let chamadas = 0
  const travado = ((_url: string, init?: RequestInit) => {
    chamadas++
    // como o fetch do navegador: só rejeita quando o sinal aborta
    return new Promise<Response>((_, rejeitar) => init?.signal?.addEventListener('abort', () => rejeitar(init.signal?.reason)))
  }) as typeof fetch
  const vivo = setInterval(() => {}, 1000) // o timer do AbortSignal.timeout não segura o Node
  try {
    const inicio = Date.now()
    await assert.rejects(pedirAoAssinador(travado, 'https://assina.teste/assinar', { method: 'POST' }, 50),
      (e: unknown) => (e as Error).message === ASSINADOR_SEM_RESPOSTA && (e as { status?: number }).status === 504)
    assert.ok(Date.now() - inicio < 2000)
    assert.equal(chamadas, 1)
  } finally {
    clearInterval(vivo)
  }
})

test('LG7: resposta do assinador: 204, erro com status e corpo', async () => {
  const { pedirAoAssinador } = await import('./assinadorPuro.ts')
  const com = (r: Response) => (async () => r) as unknown as typeof fetch
  assert.equal(await pedirAoAssinador(com(new Response(null, { status: 204 })), 'u', {}, 1000), undefined)
  await assert.rejects(pedirAoAssinador(com(new Response(JSON.stringify({ erro: 'Sem sessão de assinatura.' }), { status: 409 })), 'u', {}, 1000),
    (e: unknown) => (e as Error).message === 'Sem sessão de assinatura.' && (e as { status?: number }).status === 409)
  assert.deepEqual(await pedirAoAssinador(com(new Response(JSON.stringify({ assinatura_id: 'a1' }))), 'u', {}, 1000), { assinatura_id: 'a1' })
})

test('LG7: toda chamada ao assinador passa pelo prazo (AbortSignal.timeout)', () => {
  assert.match(puro, /signal = AbortSignal\.timeout\(prazoMs\)/)
  assert.doesNotMatch(fonte, /await fetch\(/, 'nada de fetch direto sem prazo')
  assert.match(fonte, /pedirAoAssinador<T>\(fetch,/)
  assert.match(fonte, /chamar\('\/assinar', \{[^\n]+\}, PRAZO_ASSINAR_MS\)/)
})
