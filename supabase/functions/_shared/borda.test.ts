import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enderecoPrivado, iguaisTempoConstante, ipConfiavel, lerCorpoLimitado, nomePublico, type ResolverDns } from './borda.ts'

const cab = (h: Record<string, string>) => (n: string) => h[n] ?? null

test('IP: cf-connecting-ip primeiro; senão o último do x-forwarded-for, nunca o primeiro', () => {
  assert.equal(ipConfiavel(cab({ 'x-forwarded-for': '203.0.113.77, 198.51.100.9' })), '198.51.100.9')
  assert.equal(ipConfiavel(cab({ 'x-forwarded-for': '203.0.113.77,198.51.100.9', 'cf-connecting-ip': '192.0.2.10' })), '192.0.2.10')
  assert.equal(ipConfiavel(cab({ 'x-forwarded-for': '198.51.100.9' })), '198.51.100.9')
  assert.equal(ipConfiavel(cab({ 'x-forwarded-for': ' , ' })), null)
  assert.equal(ipConfiavel(cab({})), null)
})

test('segredo: comparação em tempo constante', () => {
  assert.equal(iguaisTempoConstante('segredo-da-borda', 'segredo-da-borda'), true)
  assert.equal(iguaisTempoConstante('segredo-da-borda', 'segredo-da-bordx'), false)
  assert.equal(iguaisTempoConstante('segredo', 'segredo-maior'), false)
  assert.equal(iguaisTempoConstante('', ''), true)
})

function pedidoEmPartes(bytes: number, partes: number): Request {
  const pedaco = new Uint8Array(Math.ceil(bytes / partes)).fill(97)
  let enviados = 0
  const corpo = new ReadableStream<Uint8Array>({
    pull(c) {
      if (enviados >= bytes) { c.close(); return }
      const n = Math.min(pedaco.length, bytes - enviados)
      c.enqueue(pedaco.slice(0, n)); enviados += n
    },
  })
  return new Request('https://x.test/', { method: 'POST', body: corpo, duplex: 'half' } as RequestInit)
}

test('corpo: para ao passar do limite mesmo sem Content-Length', async () => {
  assert.deepEqual(await lerCorpoLimitado(pedidoEmPartes(2000, 4), 1000), { excedeu: true })
  const ok = await lerCorpoLimitado(pedidoEmPartes(900, 3), 1000)
  assert.ok('texto' in ok && ok.texto.length === 900)
  const declarado = new Request('https://x.test/', { method: 'POST', body: 'x', headers: { 'content-length': '5000' } })
  assert.deepEqual(await lerCorpoLimitado(declarado, 1000), { excedeu: true })
  assert.deepEqual(await lerCorpoLimitado(new Request('https://x.test/', { method: 'POST', body: '{"a":1}' }), 1000), { texto: '{"a":1}' })
})

test('endereço privado ou reservado', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.10', '169.254.169.254', '100.64.0.1',
    '0.0.0.0', '224.0.0.1', '255.255.255.255', '192.0.2.1', '198.51.100.9', '203.0.113.77', '198.18.0.1',
    '::1', '::', 'fe80::1', 'fd00::1', 'fc00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '2001:db8::1', '64:ff9b::a00:1', 'ff02::1', 'lixo']) {
    assert.equal(enderecoPrivado(ip), true, ip)
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(enderecoPrivado(ip), false, ip)
  }
})

test('nome do webhook: só passa quando todos os endereços são públicos', async () => {
  const tabela: Record<string, Record<string, string[]>> = {
    'publico.exemplo.com': { A: ['93.184.216.34'], AAAA: ['2606:2800:220:1::1'] },
    'so-v4.exemplo.com': { A: ['93.184.216.34'] },
    'interno.exemplo.com': { A: ['127.0.0.1'] },
    'misto.exemplo.com': { A: ['93.184.216.34', '10.0.0.5'] },
    'metadados.exemplo.com': { AAAA: ['::ffff:169.254.169.254'] },
  }
  const resolver: ResolverDns = async (nome, tipo) => {
    const r = tabela[nome]?.[tipo]
    if (!r) throw new Error('sem registro')
    return r
  }
  assert.deepEqual(await nomePublico('publico.exemplo.com', resolver), { ok: true })
  assert.deepEqual(await nomePublico('so-v4.exemplo.com', resolver), { ok: true })
  assert.equal((await nomePublico('interno.exemplo.com', resolver)).ok, false)
  assert.equal((await nomePublico('misto.exemplo.com', resolver)).ok, false)
  assert.equal((await nomePublico('metadados.exemplo.com', resolver)).ok, false)
  assert.equal((await nomePublico('nao-existe.exemplo.com', resolver)).ok, false)
})
