// node --experimental-strip-types --test src/lib/cofreLocal.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cifrar, decifrar, definirChave, estaCifrado, temChave } from './cofreLocal.ts'

const chaveB64 = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
const rascunho = JSON.stringify({ v: 1, salvoEm: 1, dados: { nome: 'Maria da Silva', alergias: 'dipirona', diagnostico: 'pneumonia' } })

test('sem chave não cifra nem decifra (nada é gravado em claro)', () => {
  definirChave(null)
  assert.equal(temChave(), false)
  assert.equal(cifrar(rascunho), null)
  assert.equal(decifrar('ccr1:qualquer'), null)
})

test('cifra e decifra de volta; texto cifrado não contém o dado', () => {
  definirChave(chaveB64())
  const c = cifrar(rascunho)!
  assert.ok(estaCifrado(c))
  assert.ok(!c.includes('Maria') && !c.includes('dipirona') && !c.includes('pneumonia'))
  assert.notEqual(cifrar(rascunho), c, 'nonce novo a cada gravação')
  assert.equal(decifrar(c), rascunho)
})

test('outra sessão (outra chave) ou conteúdo alterado: ilegível', () => {
  definirChave(chaveB64())
  const c = cifrar(rascunho)!
  definirChave(chaveB64()) // nova sessão
  assert.equal(decifrar(c), null)
  definirChave(null)
  assert.equal(decifrar(c), null) // logout
  const k = chaveB64()
  definirChave(k)
  const c2 = cifrar(rascunho)!
  const mexido = c2.slice(0, -4) + (c2.endsWith('AAAA') ? 'BBBB' : 'AAAA')
  assert.equal(decifrar(mexido), null)
  assert.throws(() => definirChave(Buffer.from('curta').toString('base64')), /inválida/)
})
