// Trilha de segurança, S2 (E3): sessão vinda do link só onde se espera um.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { decidirSessaoDoLink, donoDoToken, tokensDoLink } from './sessaoDoLink.ts'

const jwt = (sub: string) => `x.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.y`
const tokens = (sub: string) => ({ access_token: jwt(sub), refresh_token: 'r' })

test('lê os tokens do fragmento', () => {
  assert.deepEqual(tokensDoLink('#access_token=a&refresh_token=b&type=recovery'), { access_token: 'a', refresh_token: 'b' })
  assert.equal(tokensDoLink('#error_code=otp_expired'), null)
  assert.equal(tokensDoLink(''), null)
})

test('dono do token vem do sub', () => {
  assert.equal(donoDoToken(jwt('u-1')), 'u-1')
  assert.equal(donoDoToken('lixo'), null)
})

test('sem tokens no link: nada a fazer', () => {
  assert.equal(decidirSessaoDoLink('/recuperar-senha', null, null), 'nenhum')
})

test('fora das telas do link: ignora a sessão', () => {
  assert.equal(decidirSessaoDoLink('/', tokens('u-1'), null), 'ignorar')
  assert.equal(decidirSessaoDoLink('/cadastro', tokens('u-1'), null), 'ignorar')
})

test('na tela do link, sem sessão aberta: aceita', () => {
  assert.equal(decidirSessaoDoLink('/recuperar-senha', tokens('u-1'), null), 'aceitar')
  assert.equal(decidirSessaoDoLink('/login', tokens('u-1'), null), 'aceitar')
})

test('com sessão de outra pessoa: recusa; da mesma pessoa: aceita', () => {
  assert.equal(decidirSessaoDoLink('/recuperar-senha', tokens('u-1'), 'u-2'), 'recusar')
  assert.equal(decidirSessaoDoLink('/recuperar-senha', tokens('u-1'), 'u-1'), 'aceitar')
})

test('token sem dono legível: ignora', () => {
  assert.equal(decidirSessaoDoLink('/login', { access_token: 'lixo', refresh_token: 'r' }, null), 'ignorar')
})
