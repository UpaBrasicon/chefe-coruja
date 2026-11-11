// node --experimental-strip-types --test src/lib/exames.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { botoesDeExame, botoesDoGrupo, caminhoLaudo, grupoDoCodigo, itemDoPedidoPorta, tipoDoCodigo, codigoExameNaTela, erroLaudo, EXAMES_LIVRES_LAB, jaPedido, LAUDO_MAX_BYTES, loincValido, rotuloVersaoResultado, type ExameUnidade } from './exames.ts'

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

// ponto 12: laboratório, imagem e ECG em pedidos separados
test('grupo pelo código SIGTAP: 02.02, 02.04-02.07 e 02.11', () => {
  assert.equal(grupoDoCodigo('0202010473'), 'laboratorio')
  assert.equal(grupoDoCodigo('0204030170'), 'imagem')
  assert.equal(grupoDoCodigo('0205020046'), 'imagem')
  assert.equal(grupoDoCodigo('0211020036'), 'grafico')
  assert.equal(grupoDoCodigo('0301010072'), null)
  assert.equal(grupoDoCodigo(null), null)
})

test('botões por grupo: os da lista da unidade; sem lista no grupo, texto livre', () => {
  const lista = [ex({ procedimento: '0202990001', nome_curto: 'Hemograma' }), ex({ procedimento: '0211020036', nome_curto: 'ECG' }),
    ex({ procedimento: '0202990002', nome_curto: 'Glicemia', botao: false })]
  assert.deepEqual(botoesDoGrupo(lista, 'laboratorio'), [{ rotulo: 'Hemograma', procedimento: '0202990001' }])
  assert.deepEqual(botoesDoGrupo(lista, 'grafico'), [{ rotulo: 'ECG', procedimento: '0211020036' }])
  assert.deepEqual(botoesDoGrupo(lista, 'imagem'), [{ rotulo: 'Radiografia de tórax', procedimento: null }])
  assert.equal(botoesDoGrupo(undefined, 'laboratorio').length, EXAMES_LIVRES_LAB.length)
})

// ponto 12, pergunta 3 (RT, 10/11/2026): na porta, cada item leva o grupo
test('porta: o item do pedido leva o grupo; com código, o banco tira do código', () => {
  assert.deepEqual(itemDoPedidoPorta({ rotulo: 'Hemograma', procedimento: '0202990001' }), { procedimento: '0202990001' })
  assert.deepEqual(itemDoPedidoPorta({ rotulo: 'Radiografia de tórax', procedimento: null }), { nome: 'Radiografia de tórax', grupo: 'imagem' })
  assert.deepEqual(itemDoPedidoPorta({ rotulo: 'ECG', procedimento: null }), { nome: 'ECG', grupo: 'grafico' })
  assert.deepEqual(itemDoPedidoPorta({ rotulo: 'Lactato', procedimento: null }), { nome: 'Lactato', grupo: 'laboratorio' })
  assert.deepEqual(itemDoPedidoPorta({ rotulo: 'Tomografia de crânio', procedimento: null }, 'imagem'), { nome: 'Tomografia de crânio', grupo: 'imagem' })
})

// resultado digitado à mão é transcrição, não "liberado" (RT, 10/11/2026)
test('rótulo da versão: manual é transcrição; laboratório e imagem liberam', () => {
  assert.equal(rotuloVersaoResultado('manual', '10/11/2026, 23:01', 'Médico UPA F5'),
    'registrado à mão 10/11/2026, 23:01 · Médico UPA F5 (transcrição)')
  assert.equal(rotuloVersaoResultado('manual', '10/11/2026, 23:01', null), 'registrado à mão 10/11/2026, 23:01 (transcrição)')
  assert.equal(rotuloVersaoResultado('laboratorio', '10/11/2026, 23:01', null), 'liberado pelo laboratório 10/11/2026, 23:01')
  assert.equal(rotuloVersaoResultado('imagem', '10/11/2026, 23:01', 'Ana'), 'liberado pelo serviço de imagem 10/11/2026, 23:01 · registrado por Ana')
  assert.doesNotMatch(rotuloVersaoResultado('manual', 'x', 'y'), /liberado/)
})
