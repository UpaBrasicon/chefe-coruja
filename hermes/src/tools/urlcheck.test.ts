// Testes do verificador de URL do Cérbero (heurísticas).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heuristicas, verificarUrl, extrairUrls, hashUrl } from './urlcheck.ts'

test('heurísticas — URL com IP literal', () => {
  assert.ok(heuristicas('http://192.168.1.1/laudo.pdf').includes('ip_literal'))
})

test('heurísticas — extensão executável', () => {
  assert.ok(heuristicas('http://evil.com/laudo.pdf.exe').includes('extensao_executavel'))
  assert.ok(heuristicas('https://evil.com/virus.apk').includes('extensao_executavel'))
})

test('heurísticas — encurtador', () => {
  assert.ok(heuristicas('https://bit.ly/abc123').includes('encurtador'))
})

test('heurísticas — punycode', () => {
  assert.ok(heuristicas('https://xn--80ak6aa92e.com/').includes('punycode'))
})

test('heurísticas — credenciais na URL', () => {
  assert.ok(heuristicas('https://user:senha@evil.com/').includes('credencial_na_url'))
})

test('heurísticas — sem https', () => {
  assert.ok(heuristicas('http://google.com/').includes('sem_https'))
})

test('heurísticas — URL normal e segura', () => {
  assert.deepEqual(heuristicas('https://www.google.com/search?q=teste'), [])
})

test('verificarUrl — .exe é malicioso direto', async () => {
  const r = await verificarUrl('http://192.168.1.1/laudo.exe')
  assert.equal(r.veredicto, 'malicioso')
  assert.ok(r.motivos.includes('extensao_executavel'))
})

test('verificarUrl — IP literal sem exe é suspeito', async () => {
  const r = await verificarUrl('http://192.168.1.1/laudo.pdf')
  assert.equal(r.veredicto, 'suspeito')
})

test('verificarUrl — google.com é seguro', async () => {
  const r = await verificarUrl('https://google.com')
  assert.equal(r.veredicto, 'seguro')
})

test('extrairUrls — extrai e limpa pontuação', () => {
  assert.deepEqual(extrairUrls('veja https://google.com/a, e https://bit.ly/x!'), ['https://google.com/a', 'https://bit.ly/x'])
})

test('hashUrl — determinístico e lower-case', () => {
  assert.equal(hashUrl('HTTPS://Google.com'), hashUrl('https://google.com'))
})
