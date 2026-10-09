// node --experimental-strip-types --test src/lib/interacoes.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { interacoesDoErro, lerPrincipios } from './interacoes.ts'

test('lê as interações do erro da prescrição', () => {
  const det = JSON.stringify([{ interacao_id: 'i', outro_item_id: 'o', outro: 'Fluoxetina', gravidade: 'contraindicada', efeito: 'x', conduta: null, fonte: 'ONC', grupos: 'A × B' }])
  assert.equal(interacoesDoErro({ hint: 'interacao_critica', details: det })?.[0].outro, 'Fluoxetina')
  assert.equal(interacoesDoErro({ hint: null, details: det }), null)
  assert.equal(interacoesDoErro({ hint: 'interacao_critica', details: 'quebrado' }), null)
  assert.equal(interacoesDoErro(null), null)
})

test('lista de princípios do grupo', () => {
  assert.deepEqual(lerPrincipios('Fluoxetina, Sertralina; fluoxetina\nab'), ['fluoxetina', 'sertralina'])
})
