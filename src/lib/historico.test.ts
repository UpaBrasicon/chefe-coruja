// node --experimental-strip-types --test src/lib/historico.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { motivoValido, rotuloDesfechoFinal } from './historico.ts'

test('desfecho final por extenso, da porta e da internação', () => {
  assert.equal(rotuloDesfechoFinal('alta_melhorada'), 'Alta')
  assert.equal(rotuloDesfechoFinal('alta_evasao'), 'Evasão')
  assert.equal(rotuloDesfechoFinal('alta_apos_medicacao'), 'Alta após medicação')
  assert.equal(rotuloDesfechoFinal(null), 'Encerrado')
  assert.equal(rotuloDesfechoFinal('algo_novo'), 'algo novo')
})

test('motivo com 10 letras ou mais, como no banco', () => {
  assert.equal(motivoValido('curto'), false)
  assert.equal(motivoValido('   1234567890  '), true)
})
