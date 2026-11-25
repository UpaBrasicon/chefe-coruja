import assert from 'node:assert/strict'
import { test } from 'node:test'

import { primeiraRecusaDePlantao, recusaDePlantao } from './regulacaoPlantao.ts'

const UNIDADE = 'Fora do plantão: você não está de plantão agora nesta unidade (sem escala ativa ou com o check-out feito).'
const SETOR = 'Fora do plantão neste setor: o paciente não está num setor do seu plantão agora.'

test('recusa de plantão: devolve a frase do servidor como veio', () => {
  assert.equal(recusaDePlantao(new Error(UNIDADE)), UNIDADE)
  assert.equal(recusaDePlantao({ message: SETOR, code: '42501' }), SETOR)
  assert.equal(recusaDePlantao(`  ${SETOR} `), SETOR)
})

test('recusa de plantão: outro erro não é aviso de plantão', () => {
  assert.equal(recusaDePlantao(new Error('Solicitação não encontrada.')), null)
  assert.equal(recusaDePlantao(new Error('Erro: Fora do plantão')), null)
  assert.equal(recusaDePlantao(null), null)
  assert.equal(recusaDePlantao(undefined), null)
  assert.equal(recusaDePlantao({ message: 42 }), null)
})

test('primeira recusa de plantão entre os erros da peça', () => {
  assert.equal(primeiraRecusaDePlantao(null, new Error('outro'), new Error(SETOR), new Error(UNIDADE)), SETOR)
  assert.equal(primeiraRecusaDePlantao(null, new Error('outro')), null)
  assert.equal(primeiraRecusaDePlantao(), null)
})
