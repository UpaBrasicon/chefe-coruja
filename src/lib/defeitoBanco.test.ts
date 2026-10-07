// node --experimental-strip-types --test src/lib/defeitoBanco.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ehDefeitoDoBanco } from './defeitoBanco.ts'

test('defeito do banco: erro interno de função entra; recusa de regra fica de fora', () => {
  // defeitos
  assert.equal(ehDefeitoDoBanco(400, '22012'), true) // divisão por zero
  assert.equal(ehDefeitoDoBanco(400, '22P02'), true) // texto inválido para tipo
  assert.equal(ehDefeitoDoBanco(400, '42703'), true) // coluna inexistente
  assert.equal(ehDefeitoDoBanco(404, 'PGRST202'), true) // função ausente
  assert.equal(ehDefeitoDoBanco(400, 'P0004'), true) // ASSERT falhou
  assert.equal(ehDefeitoDoBanco(409, '40P01'), true) // deadlock
  assert.equal(ehDefeitoDoBanco(500, null), true)
  // regra / esperado
  assert.equal(ehDefeitoDoBanco(400, 'P0001'), false) // RAISE EXCEPTION das RPCs
  assert.equal(ehDefeitoDoBanco(403, '42501'), false) // permissão / portão do 2FA
  assert.equal(ehDefeitoDoBanco(401, 'PGRST301'), false) // JWT
  assert.equal(ehDefeitoDoBanco(409, '23505'), false) // duplicado (duplo clique)
  assert.equal(ehDefeitoDoBanco(400, '23514'), false) // CHECK de regra
  assert.equal(ehDefeitoDoBanco(400, null), false)
  assert.equal(ehDefeitoDoBanco(200, '22012'), false)
})
