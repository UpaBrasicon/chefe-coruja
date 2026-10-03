// node --test scripts/arquivo/cofre.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assinar, cifrar, decifrar, derivarChave, novoSal, salDe } from './cofre.mjs'

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
