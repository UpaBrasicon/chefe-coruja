// node --test scripts/arquivo/cofre.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import { abrirEnvelope, assinar, cifrar, cifrar2, decifrar, decifrar2, derivarChave, digitalDaChave, envelopeDe, formatoDe, novaChaveEnvelopada, novoSal, salDe } from './cofre.mjs'

test('cifra e decifra de volta; senha errada e arquivo alterado falham', () => {
  const sal = novoSal()
  const chave = derivarChave('senha-de-teste-longa', sal)
  const claro = Buffer.from('prontuário de teste ✓')
  const c = cifrar(chave, sal, claro)
  assert.ok(salDe(c).equals(sal))
  assert.ok(decifrar(chave, c).equals(claro))
  assert.throws(() => decifrar(derivarChave('outra-senha-longa', sal), c), /senha errada/)
  const mexido = Buffer.from(c); mexido[mexido.length - 1] ^= 1
  assert.throws(() => decifrar(chave, mexido), /senha errada ou arquivo alterado/)
  assert.throws(() => salDe(Buffer.from('xxxx')), /não é um arquivo/)
})

// Exemplo "GET Object" da documentação da AWS (Signature Version 4, cabeçalho
// Authorization): mesma chave, data e cabeçalhos → mesma assinatura.
test('assinatura SigV4 confere com o exemplo da AWS', () => {
  const { cabecalhos } = assinar({
    metodo: 'GET', bucket: 'examplebucket', regiao: 'us-east-1', chaveObjeto: 'test.txt', host: 'examplebucket.s3.amazonaws.com',
    cabecalhos: { range: 'bytes=0-9' },
    corpoHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    cred: { id: 'AKIAIOSFODNN7EXAMPLE', segredo: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
    agora: new Date('2013-05-24T00:00:00Z'),
  })
  assert.match(cabecalhos.authorization, /Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/)
})

// Guarda automática (CCG2): o servidor cifra só com a chave pública; abrir
// exige a chave privada e a frase dela.
test('CCG2: cifra com a pública, abre só com a privada e a frase', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'frase-de-teste-longa' },
  })
  const { chave, envelope } = novaChaveEnvelopada(publicKey)
  const claro = Buffer.from('prontuário de teste ✓')
  const c = cifrar2(chave, envelope, claro)
  assert.equal(formatoDe(c), 'CCG2')
  const aberta = abrirEnvelope(privateKey, 'frase-de-teste-longa', envelopeDe(c))
  assert.ok(decifrar2(aberta, c).equals(claro))
  assert.throws(() => abrirEnvelope(privateKey, 'frase-errada-longa', envelopeDe(c)), /frase erradas/)
  const outra = generateKeyPairSync('rsa', { modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
  assert.throws(() => abrirEnvelope(outra.privateKey, undefined, envelopeDe(c)), /outra chave/)
  const mexido = Buffer.from(c); mexido[mexido.length - 1] ^= 1
  assert.throws(() => decifrar2(aberta, mexido), /arquivo alterado/)
  assert.match(digitalDaChave(publicKey), /^([0-9a-f]{4}:){15}[0-9a-f]{4}$/)
  assert.ok(!c.includes(chave), 'a chave da guarda não pode ir em claro no arquivo')
})
