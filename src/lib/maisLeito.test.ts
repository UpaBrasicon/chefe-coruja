// node --experimental-strip-types --test src/lib/maisLeito.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ITENS_MAIS, ehItemMais, situacoesMais } from './maisLeito.ts'

const base = { internacaoId: 'i1', documentos: [], cadastroFaltaAih: [], pareceresAbertos: 0, encaminhamentoPendente: false, apacs: [], pediatrico: false }

test('a Admissão não está no Mais', () => {
  assert.equal(ITENS_MAIS.includes('admissao' as never), false)
  assert.equal(ehItemMais('aih'), true)
  assert.equal(ehItemMais('resumo'), false)
})

test('AIH: laudo, rascunho, cadastro incompleto ou não feito', () => {
  assert.equal(situacoesMais({ ...base, cadastroFaltaAih: ['CNS'] }).aih, 'cadastro incompleto')
  assert.equal(situacoesMais({ ...base, documentos: [{ tipo: 'laudo_aih', estado: 'rascunho', numero: null, internacao_id: 'i1' }] }).aih, 'rascunho aberto')
  assert.equal(situacoesMais({ ...base, documentos: [{ tipo: 'laudo_aih', estado: 'ativo', numero: '2026/7', internacao_id: 'i1' }] }).aih, 'laudo nº 2026/7')
  assert.equal(situacoesMais({ ...base, documentos: [{ tipo: 'laudo_aih', estado: 'ativo', numero: '1', internacao_id: 'outra' }] }).aih, 'não feito')
})

test('parecer, escalas pela idade', () => {
  assert.equal(situacoesMais({ ...base, pareceresAbertos: 2 }).parecer, '2 aguardando resposta')
  assert.equal(situacoesMais(base).escalas, 'Braden e Morse')
  assert.equal(situacoesMais({ ...base, pediatrico: true }).escalas, 'NIPS/FLACC e curva de crescimento')
})
