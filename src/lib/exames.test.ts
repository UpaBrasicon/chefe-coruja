// node --experimental-strip-types --test src/lib/exames.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { botoesDeExame, caminhoLaudo, tipoDoCodigo, codigoExameNaTela, erroLaudo, EXAMES_LIVRES_LAB, jaPedido, LAUDO_MAX_BYTES, loincValido, type ExameUnidade } from './exames.ts'

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

test('laudo: só PDF até 10 MB; caminho na pasta do exame, sem acento nem espaço', () => {
  assert.equal(erroLaudo({ name: 'a.pdf', type: 'application/pdf', size: 1000 }), null)
  assert.equal(erroLaudo({ name: 'a.png', type: 'image/png', size: 1000 }), 'O laudo precisa ser PDF.')
  assert.equal(erroLaudo({ name: 'a.pdf', type: 'application/pdf', size: LAUDO_MAX_BYTES + 1 }), 'O laudo passa de 10 MB.')
  assert.equal(caminhoLaudo('ex-1', 'Laudo Hemograma ção.pdf', 5), 'ex-1/5-Laudo-Hemograma-cao.pdf')
})

test('5C-2: com exame de imagem na lista, RX e ECG em texto livre saem dos botões; foto só em imagem', () => {
  const b = botoesDeExame([ex({ ordem: 1 }), ex({ nome_curto: 'RX de tórax', procedimento: '0204030153', ordem: 2 })])
  assert.deepEqual(b.map((x) => x.rotulo), ['Hemograma', 'RX de tórax'])
  assert.equal(tipoDoCodigo('0211020036'), 'imagem')
  assert.equal(tipoDoCodigo('0202020380'), 'laboratorio')
  assert.equal(tipoDoCodigo(null), null)
  assert.equal(erroLaudo({ name: 'ecg.jpg', type: 'image/jpeg', size: 10 }, true), null)
  assert.equal(erroLaudo({ name: 'ecg.jpg', type: 'image/jpeg', size: 10 }), 'O laudo precisa ser PDF.')
  assert.equal(caminhoLaudo('ex-1', 'traçado.PNG', 5), 'ex-1/5-tracado.PNG')
})
