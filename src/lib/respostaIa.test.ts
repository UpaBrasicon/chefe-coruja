// node --experimental-strip-types --test src/lib/respostaIa.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { citacoes, fontesCitadas, NAO_ENCONTREI, SEM_PEDIATRIA, semResposta } from './respostaIa.ts'

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

test('resposta pronta lista só as fontes citadas no texto', () => {
  const fontes = [1, 2, 3, 4, 5, 6].map((n) => ({ n }))
  const t = 'Critérios [2]. Gravidade [2, 1]. Cetonúria [1].'
  assert.deepEqual(fontesCitadas(t, fontes).map((f) => f.n), [1, 2])
  assert.deepEqual([...citacoes('sem citação')], [])
  assert.equal(fontesCitadas('sem citação', fontes).length, 6)
})
