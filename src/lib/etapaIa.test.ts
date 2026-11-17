import assert from 'node:assert/strict'
import { test } from 'node:test'

import { etapaDoEvento, etapaVisivel, ROTULO_ETAPA } from './etapaIa.ts'

test('enquanto carrega: começa em "lendo" e segue a etapa que o servidor manda', () => {
  assert.equal(etapaVisivel('loading', '', null), 'lendo')
  assert.equal(etapaVisivel('loading', '', 'procurando'), 'procurando')
})

test('depois da meta e antes do texto: "escrevendo"; com texto, some', () => {
  assert.equal(etapaVisivel('streaming', '', 'procurando'), 'escrevendo')
  assert.equal(etapaVisivel('streaming', 'Adrenalina', 'procurando'), null)
  assert.equal(etapaVisivel('done', '', null), null)
  assert.equal(etapaVisivel('blocked', '', 'procurando'), null)
})

test('valor desconhecido do servidor é ignorado', () => {
  assert.equal(etapaDoEvento('procurando'), 'procurando')
  assert.equal(etapaDoEvento('outra'), null)
  assert.equal(etapaDoEvento(undefined), null)
})

test('rótulos em português simples', () => {
  assert.deepEqual(Object.values(ROTULO_ETAPA), ['Lendo a pergunta', 'Procurando nas fontes', 'Escrevendo a resposta'])
})
