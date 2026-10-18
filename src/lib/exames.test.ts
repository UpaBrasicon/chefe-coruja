// node --experimental-strip-types --test src/lib/exames.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { botoesDeExame, codigoExameNaTela, EXAMES_LIVRES_LAB, jaPedido, loincValido, type ExameUnidade } from './exames.ts'

const ex = (p: Partial<ExameUnidade>): ExameUnidade => ({
  id: 'x', procedimento: '0202990001', nome_curto: 'Hemograma', nome_sigtap: null, loinc: null, botao: true, ordem: 0,
  definido_por: null, definido_em: '2026-10-18T00:00:00Z', ...p,
})

test('sem lista da unidade: botões de antes, em texto livre', () => {
  const b = botoesDeExame([])
  assert.equal(b.length, EXAMES_LIVRES_LAB.length + 2)
  assert.ok(b.every((x) => x.procedimento === null))
})

test('com lista: laboratório vem dos marcados, na ordem; imagem e ECG continuam', () => {
  const b = botoesDeExame([ex({ nome_curto: 'Glicemia', procedimento: '0202990002', ordem: 2 }), ex({ ordem: 1 }), ex({ nome_curto: 'Potássio', botao: false })])
  assert.deepEqual(b.map((x) => x.rotulo), ['Hemograma', 'Glicemia', 'Radiografia de tórax', 'ECG'])
  assert.equal(b[0].procedimento, '0202990001')
})

test('já pedido: pelo código, senão pelo nome; cancelado não conta', () => {
  const pedidos = [{ exame: 'Hemograma', procedimento: '0202990001', situacao: 'pedido' }, { exame: 'ECG', procedimento: null, situacao: 'cancelado' }]
  assert.equal(jaPedido({ rotulo: 'Hemo', procedimento: '0202990001' }, pedidos), true)
  assert.equal(jaPedido({ rotulo: 'ECG', procedimento: null }, pedidos), false)
})

test('código e LOINC na tela', () => {
  assert.equal(codigoExameNaTela('0202010040'), '02.02.01.004-0')
  assert.equal(loincValido(''), true)
  assert.equal(loincValido('12345-6'), true)
  assert.equal(loincValido('12345'), false)
})
