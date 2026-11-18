// Cliente DOC-ICP-17 contra um servidor de teste que segue o padrão, e a
// guarda cifrada das sessões. Nenhuma credencial real.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, privateEncrypt, constants, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assinarHash, certificados, pkce, provedoresDoAmbiente, trocarCodigo, urlAutorizacao, type Provedor } from '../src/docicp17.ts'
import { Cofre, Pendentes, Sessoes } from '../src/sessoes.ts'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PREFIXO = Buffer.from('3031300d060960864801650304020105000420', 'hex')

/** Servidor que imita o DOC-ICP-17: confere PKCE, token Bearer e assina RAW. */
async function servidorDeTeste() {
  const codigos = new Map<string, string>() // code → challenge
  const tokens = new Set<string>()
  const pedidos: string[] = []
  const srv = createServer(async (req, res) => {
    let corpo = ''
    for await (const c of req) corpo += c
    const url = new URL(req.url!, 'http://x')
    pedidos.push(url.pathname)
    const resp = (status: number, j: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)) }
    if (url.pathname === '/v0/oauth/token') {
      const f = new URLSearchParams(corpo)
      const challenge = codigos.get(f.get('code') ?? '')
      const conferido = createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url')
      if (!challenge || challenge !== conferido || f.get('client_secret') !== 'segredo') return resp(400, { error: 'invalid_grant' })
      const t = randomBytes(16).toString('hex'); tokens.add(t)
      return resp(200, { access_token: t, token_type: 'Bearer', expires_in: 43200 })
    }
    const token = (req.headers.authorization ?? '').replace('Bearer ', '')
    if (!tokens.has(token)) return resp(401, { error: 'invalid_token' })
    if (url.pathname === '/v0/oauth/certificate-discovery') {
      return resp(200, { certificates: [{ alias: 'cert-medico', certificate: Buffer.from('DER-DE-TESTE').toString('base64'), certificate_chain: [] }] })
    }
    if (url.pathname === '/v0/oauth/signature') {
      const j = JSON.parse(corpo)
      const h = Buffer.from(j.hashes[0].hash, 'base64')
      const sig = privateEncrypt({ key: privateKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.concat([PREFIXO, h]))
      return resp(200, { certificate_alias: j.certificate_alias, signatures: [{ id: '1', raw_signature: sig.toString('base64') }] })
    }
    resp(404, {})
  })
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()))
  const porta = (srv.address() as { port: number }).port
  return { srv, porta, codigos, pedidos }
}

const provedor = (porta: number): Provedor => ({
  id: 'vidaas', nome: 'Teste', base: `http://127.0.0.1:${porta}`, clientId: 'cli', clientSecret: 'segredo',
  redirectUri: 'https://assina.exemplo/retorno', hashEm: 'base64',
  caminhos: { autorizar: '/v0/oauth/authorize', token: '/v0/oauth/token', certificados: '/v0/oauth/certificate-discovery', assinar: '/v0/oauth/signature' },
})

test('autorização: PKCE S256, escopo signature_session e validade da sessão', () => {
  const { challenge, verifier } = pkce()
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'))
  const u = new URL(urlAutorizacao(provedor(1), { estado: 'e1', challenge, segundos: 6 * 3600 }))
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(u.searchParams.get('scope'), 'signature_session')
  assert.equal(u.searchParams.get('lifetime'), String(6 * 3600))
  assert.equal(u.searchParams.get('client_secret'), null, 'o segredo nunca vai na URL')
})

test('fluxo completo contra o servidor de teste: token, certificado e assinatura RAW do hash', async () => {
  const { srv, porta, codigos } = await servidorDeTeste()
  try {
    const p = provedor(porta)
    const { verifier, challenge } = pkce()
    codigos.set('codigo-1', challenge)
    await assert.rejects(trocarCodigo(p, 'codigo-1', 'verifier-errado'), /token: HTTP 400/)
    codigos.set('codigo-2', challenge)
    const { token } = await trocarCodigo(p, 'codigo-2', verifier)
    const [c] = await certificados(p, token)
    assert.equal(c.alias, 'cert-medico')
    const hash = createHash('sha256').update('atributos').digest()
    const assinatura = await assinarHash(p, token, c.alias, hash, 'Atestado nº 1')
    assert.equal(assinatura.length, 256)
    await assert.rejects(assinarHash(p, 'token-falso', c.alias, hash, 'x'), /assinatura: HTTP 401/)
  } finally {
    srv.close()
  }
})

test('provedores só entram com base, client_id, segredo e endereço de retorno no ambiente', () => {
  assert.deepEqual(provedoresDoAmbiente({}), [])
  const ps = provedoresDoAmbiente({ ASSINADOR_RETORNO: 'https://r', VIDAAS_BASE: 'https://v', VIDAAS_CLIENT_ID: 'a', VIDAAS_CLIENT_SECRET: 'b', BIRDID_BASE: 'https://b' })
  assert.deepEqual(ps.map((p) => p.id), ['vidaas'])
})

test('sessão: token cifrado em disco, some ao vencer e o arquivo não tem o token em claro', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sessoes-'))
  const arquivo = join(dir, 'sessoes.json')
  let agora = new Date('2026-11-18T10:00:00Z')
  const cofre = new Cofre(randomBytes(32).toString('hex'))
  const s = new Sessoes(cofre, arquivo, () => agora)
  s.guardar({ sessaoId: 's1', perfilId: 'p1', provedor: 'vidaas', alias: 'a', certificadoDer: '', cadeiaDer: [], validaAte: '2026-11-18T19:00:00Z', token: 'TOKEN-SECRETO-123' })
  assert.doesNotMatch(readFileSync(arquivo, 'utf8'), /TOKEN-SECRETO/)
  const outra = new Sessoes(cofre, arquivo, () => agora)
  assert.equal(outra.daPessoa('p1')?.token, 'TOKEN-SECRETO-123', 'sobrevive à reinicialização')
  agora = new Date('2026-11-18T19:00:01Z')
  assert.equal(outra.daPessoa('p1'), undefined, 'vencida some')
  assert.throws(() => new Cofre('curta'), /32 bytes/)
  assert.throws(() => new Cofre(randomBytes(32).toString('hex')).decifrar(cofre.cifrar('x')), 'chave errada não decifra')
})

test('pedido de autorização: estado de uso único e vale 10 minutos', () => {
  let agora = 0
  const p = new Pendentes(() => agora)
  const e = p.abrir({ perfilId: 'p1', cpf: '12345678909', provedor: 'vidaas', verifier: 'v', validaAte: 'x' })
  assert.equal(p.tomar(e)?.perfilId, 'p1')
  assert.equal(p.tomar(e), undefined, 'uso único')
  const e2 = p.abrir({ perfilId: 'p1', cpf: '12345678909', provedor: 'vidaas', verifier: 'v', validaAte: 'x' })
  agora = 10 * 60_000 + 1
  assert.equal(p.tomar(e2), undefined, 'vencido')
})
