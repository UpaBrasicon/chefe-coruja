import assert from 'node:assert/strict'
import { test } from 'node:test'

import { lerSugestoes, proximoHistorico, seguimentoValido, trocaDaResposta } from './conversaIa.ts'

test('o histórico guarda só as 2 últimas trocas', () => {
  let h = proximoHistorico([], { pergunta: 'a', resposta: '1' })
  h = proximoHistorico(h, { pergunta: 'b', resposta: '2' })
  h = proximoHistorico(h, { pergunta: 'c', resposta: '3' })
  assert.deepEqual(h.map((t) => t.pergunta), ['b', 'c'])
})

test('"não encontrei" guarda a pergunta sem a resposta', () => {
  assert.deepEqual(trocaDaResposta('dose x', 'Não encontrei isso no material de referência.', true), { pergunta: 'dose x', resposta: '' })
  assert.deepEqual(trocaDaResposta('dose x', ' Amiodarona [1]. ', false), { pergunta: 'dose x', resposta: 'Amiodarona [1].' })
})

test('sugestões: no máximo 3, sem repetir e sem lixo', () => {
  assert.deepEqual(lerSugestoes(undefined), [])
  assert.deepEqual(lerSugestoes(['Carga da cardioversão', 'carga da cardioversão', 3, '', 'Dose na FA estável', 'Interação com anticoagulante', 'Quarta']),
    ['Carga da cardioversão', 'Dose na FA estável', 'Interação com anticoagulante'])
})

test('campo de seguimento: entre 3 e 800 caracteres', () => {
  assert.equal(seguimentoValido('  e '), false)
  assert.equal(seguimentoValido('e na criança?'), true)
  assert.equal(seguimentoValido('x'.repeat(801)), false)
})
