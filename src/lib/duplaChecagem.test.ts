// node --experimental-strip-types --test src/lib/duplaChecagem.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { doseUnicaFeita, estadoLiberacao, origemAltaVigilancia, type ItemAltaVigilancia, type Liberacao } from './duplaChecagem.ts'

test('estado da liberação da farmácia', () => {
  const base: Liberacao = { item_id: 'i', regra: 'Analgésicos opioides', situacao: null, motivo: null, por: null, em: null }
  assert.equal(estadoLiberacao(undefined), 'nao_exige')
  assert.equal(estadoLiberacao(base), 'aguardando')
  assert.equal(estadoLiberacao({ ...base, situacao: 'confere', por: 'Fábio', em: '2026-10-09T22:00:00Z' }), 'liberado')
  assert.equal(estadoLiberacao({ ...base, situacao: 'devolvido', motivo: 'dose acima do protocolo' }), 'devolvido')
})

test('dose única "Agora" já feita não volta a pedir checagem', () => {
  assert.equal(doseUnicaFeita('Agora', false, 'feito'), true)
  assert.equal(doseUnicaFeita(' agora ', false, 'feito'), true)
  assert.equal(doseUnicaFeita('Agora', false, null), false)
  assert.equal(doseUnicaFeita('Agora', false, 'nao_feito'), false)
  assert.equal(doseUnicaFeita('8/8h', false, 'feito'), false)
  assert.equal(doseUnicaFeita('Agora', true, 'feito'), false)
})

test('origem da exigência', () => {
  const base: ItemAltaVigilancia = { id: 'm', principio_ativo: 'Morfina', apresentacao: 'amp', concentracao: null, cadastro: true, regra: 'Analgésicos opioides', exige: true, ajuste: null }
  assert.equal(origemAltaVigilancia(base), 'ISMP Brasil 2019 — Analgésicos opioides')
  assert.equal(origemAltaVigilancia({ ...base, ajuste: { exige: false, motivo: 'x', por: null, em: '' } }), 'Desmarcado pela unidade')
  assert.equal(origemAltaVigilancia({ ...base, regra: null }), 'Marcado no cadastro')
})
