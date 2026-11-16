// Conferência do SHA-256 do zip da SIGTAP (S10, H6)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { conferirSha256, lerSha256Esperado, sha256Hex } from '../lib/sha256.ts'

// SHA-256 de "abc" (vetor do FIPS 180-2)
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
const bytes = new TextEncoder().encode('abc')

describe('sha256', () => {
  it('calcula o hash conhecido', () => {
    assert.equal(sha256Hex(bytes), ABC)
  })

  it('confere: igual passa (maiúsculas também); diferente lança e não grava', () => {
    conferirSha256(bytes, ABC)
    conferirSha256(bytes, ABC.toUpperCase())
    assert.throws(() => conferirSha256(new TextEncoder().encode('abd'), ABC), /não confere/)
  })

  it('--sha256 é obrigatório e precisa ter 64 hex', () => {
    assert.equal(lerSha256Esperado(['node', 'x.ts', '--sha256', ABC]), ABC)
    assert.equal(lerSha256Esperado(['node', 'x.ts', `--sha256=${ABC.toUpperCase()}`]), ABC)
    assert.throws(() => lerSha256Esperado(['node', 'x.ts']), /--sha256/)
    assert.throws(() => lerSha256Esperado(['node', 'x.ts', '--sha256', 'abc']), /inválido/)
    assert.throws(() => lerSha256Esperado(['node', 'x.ts', '--sha256']), /--sha256/)
  })
})
