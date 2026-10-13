// node --experimental-strip-types --test src/lib/respostaIa.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NAO_ENCONTREI, SEM_PEDIATRIA, semResposta } from './respostaIa.ts'

test('sem resposta: fica só a frase, sem a lista de assuntos que o modelo acrescenta', () => {
  const t = 'Não encontrei isso no material de referência.\n\nOs trechos disponíveis tratam de Maddrey [1]; Child-Pugh [2].'
  assert.equal(semResposta(t), NAO_ENCONTREI)
  assert.equal(semResposta(`${SEM_PEDIATRIA} Os trechos são de adulto.`), SEM_PEDIATRIA)
  assert.equal(semResposta('Não encontrei isso no material de referência'), 'Não encontrei isso no material de referência')
})

test('resposta com conteúdo não é cortada', () => {
  assert.equal(semResposta('Insulina 0,05 a 0,1 U/kg/h [1].'), null)
  assert.equal(semResposta('Dose de referência: não encontrei a apresentação, mas...'), null)
})
