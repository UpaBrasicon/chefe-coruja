// Trilha de segurança, S3 (T3): clinical-search confere o segundo fator antes
// de usar a chave secreta.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { segundoFatorFalta } from './segundo.ts'

test('2FA exigido e válido: passa', () => {
  assert.equal(segundoFatorFalta([{ exigido: true, valido: true }]), false)
})

test('2FA exigido e não válido: falta', () => {
  assert.equal(segundoFatorFalta([{ exigido: true, valido: false }]), true)
})

test('2FA não exigido na plataforma: passa', () => {
  assert.equal(segundoFatorFalta([{ exigido: false, valido: false }]), false)
})

test('resposta ausente, vazia ou malformada: falha fechada', () => {
  assert.equal(segundoFatorFalta(null), true)
  assert.equal(segundoFatorFalta(undefined), true)
  assert.equal(segundoFatorFalta([]), true)
  assert.equal(segundoFatorFalta('ok'), true)
  assert.equal(segundoFatorFalta([{ exigido: true }]), true)
})

test('objeto único (não lista) também é lido', () => {
  assert.equal(segundoFatorFalta({ exigido: true, valido: true }), false)
})
