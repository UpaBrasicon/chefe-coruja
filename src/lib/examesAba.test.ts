// node --experimental-strip-types --test src/lib/examesAba.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  analitosConhecidos, cidDoCampo, conteudoDaFolha, envioPorSetor, instanteDoCampo, itensDoLancamento, montarPlanilha, pedidosDaCesta, porNaCesta,
  resumoJaPedido, setorSugerido, textoJaPedido, type ResultadoLido,
} from './examesAba.ts'

test('cesta: combo e frequente não repetem o que já está', () => {
  const r1 = porNaCesta([], [{ rotulo: 'Hemograma', procedimento: '0202020380', grupo: 'laboratorio' }, { rotulo: 'PCR', procedimento: '0202030202', grupo: 'laboratorio' }])
  assert.equal(r1.entraram, 2)
  const r2 = porNaCesta(r1.cesta, [{ rotulo: 'Hemograma completo', procedimento: '0202020380', grupo: 'laboratorio' }, { rotulo: 'ECG', procedimento: null, grupo: 'grafico' }])
  assert.equal(r2.entraram, 1)
  assert.equal(r2.cesta.length, 3)
  assert.equal(r2.cesta[0].obs, '')
})

test('pedido: um por setor, cada item com a observação, a indicação e o CID', () => {
  const cesta = [
    { rotulo: 'Hemograma', procedimento: '0202020380', grupo: 'laboratorio' as const, obs: ' jejum ' },
    { rotulo: 'Radiografia de tórax', procedimento: null, grupo: 'imagem' as const, obs: '' },
    { rotulo: 'PCR', procedimento: '0202030202', grupo: 'laboratorio' as const, obs: '' },
  ]
  const p = pedidosDaCesta(cesta, { indicacao: ' Febre ', cid: 'A41.9' })
  assert.deepEqual(p.map((x) => x.grupo), ['laboratorio', 'imagem'])
  assert.deepEqual(p[0].itens[0], { procedimento: '0202020380', obs: 'jejum', indicacao: 'Febre', cid: 'A41.9' })
  assert.deepEqual(p[0].itens[1], { procedimento: '0202030202', indicacao: 'Febre', cid: 'A41.9' })
  assert.deepEqual(p[1].itens[0], { nome: 'Radiografia de tórax', indicacao: 'Febre', cid: 'A41.9' })
  // sem indicação e sem CID, o item vai como antes
  assert.deepEqual(pedidosDaCesta([cesta[2]], { indicacao: '', cid: null })[0].itens[0], { procedimento: '0202030202' })
})

test('CID do campo no formato do banco', () => {
  assert.equal(cidDoCampo(''), null)
  assert.equal(cidDoCampo('a419'), 'A41.9')
  assert.equal(cidDoCampo('A41.9 — Sepse não especificada'), 'A41.9')
  assert.equal(cidDoCampo('I10'), 'I10')
  assert.equal(cidDoCampo('sepse'), undefined)
})

test('setor sugerido do exame avulso pelo nome (quem pede troca)', () => {
  assert.equal(setorSugerido('ECG de repouso'), 'grafico')
  assert.equal(setorSugerido('Tomografia de crânio'), 'imagem')
  assert.equal(setorSugerido('RX de tórax'), 'imagem')
  assert.equal(setorSugerido('Ácido úrico'), 'laboratorio')
})

test('já pedido: vezes e data do último, sem os cancelados', () => {
  const p = [
    { exame: 'Hemograma', procedimento: '0202020380', situacao: 'resultado', pedido_em: '2026-10-25T10:00:00Z' },
    { exame: 'Hemograma', procedimento: '0202020380', situacao: 'pedido', pedido_em: '2026-10-27T10:00:00Z' },
    { exame: 'Hemograma', procedimento: '0202020380', situacao: 'cancelado', pedido_em: '2026-10-28T10:00:00Z' },
  ]
  const r = resumoJaPedido({ rotulo: 'Hemograma', procedimento: '0202020380' }, p)
  assert.deepEqual(r, { vezes: 2, ultimo: '2026-10-27T10:00:00Z' })
  assert.equal(textoJaPedido(r, '27/10'), '2× · 27/10')
  assert.equal(textoJaPedido({ vezes: 1 }, '27/10'), '27/10')
  assert.equal(resumoJaPedido({ rotulo: 'PCR', procedimento: null }, p), null)
})

test('folha: única com um grupo por setor, ou uma folha por setor', () => {
  const ex = [
    { exame: 'Hemograma', grupo: 'laboratorio' as const, obs: 'jejum', urgencia: 'rotina', indicacao: 'Febre', cid: 'A41.9' },
    { exame: 'ECG', grupo: 'grafico' as const, urgencia: 'urgente', indicacao: 'Febre', cid: 'A41.9' },
  ]
  const u = conteudoDaFolha(ex, 'unica')
  assert.equal(u.pedido.folhas.length, 1)
  assert.deepEqual(u.pedido.folhas[0].grupos.map((g) => g.nome), ['Laboratório', 'ECG'])
  assert.deepEqual(u.pedido.folhas[0].grupos[0].itens, ['Hemograma (obs.: jejum)'])
  assert.equal(u.pedido.carater, 'Urgência')
  assert.equal(u.pedido.indicacao, 'Febre')
  assert.equal(u.pedido.cid, 'A41.9')
  assert.equal('texto' in u.pedido, false)
  const s = conteudoDaFolha(ex, 'setor', { urgente: false, indicacao: 'Dor', cid: null })
  assert.equal(s.pedido.folhas.length, 2)
  assert.equal(s.pedido.folhas[1].documento, 'Solicitação de métodos gráficos (ECG)')
  assert.equal(s.pedido.carater, 'Rotina')
  assert.equal(s.pedido.indicacao, 'Dor')
})

const res = (p: Partial<ResultadoLido>): ResultadoLido => ({
  exame_id: 'e', exame: 'Hemograma', grupo: 'laboratorio', tipo: 'laboratorio', resultado_id: 'r', versao: 1, origem: 'laboratorio',
  tem_arquivo: false, arquivo_nome: null, liberado_em: '2026-11-20T12:00:00Z', coleta_em: null, critico: false, registrado_por: null,
  alterado_em: null, alterado_por: null, itens: [], ...p,
})
const item = (analito: string, valor: string, extra: Partial<ResultadoLido['itens'][number]> = {}) =>
  ({ analito, valor, valor_num: null, unidade: null, referencia: null, marca: null, critico: false, ...extra })

test('planilha: analito × data da coleta, agrupada pelo exame, mais recente primeiro', () => {
  const p = montarPlanilha([
    res({ exame_id: '1', coleta_em: '2026-11-20T08:00:10Z', itens: [item('Hemoglobina', '10,4', { unidade: 'g/dL', referencia: '12-16', marca: 'L' }), item('Leucócitos', '14.200')] }),
    res({ exame_id: '2', coleta_em: '2026-11-22T08:00:00Z', origem: 'manual', itens: [item('Hemoglobina', '11,0')] }),
    res({ exame_id: '3', exame: 'Potássio', coleta_em: '2026-11-20T08:00:40Z', itens: [item('Potássio', '6,1', { critico: true, marca: 'HH' })] }),
    res({ exame_id: '4', exame: 'Raio X', itens: [] }),
  ])
  // a mesma coleta (mesmo minuto) é uma coluna; sem itens não entra
  assert.equal(p.colunas.length, 2)
  assert.equal(p.colunas[0].manual, true)
  assert.equal(p.colunas[1].manual, false)
  assert.deepEqual(p.grupos.map((g) => g.exame), ['Hemograma', 'Potássio'])
  const hb = p.grupos[0].linhas[0]
  assert.equal(hb.analito, 'Hemoglobina')
  // unidade e faixa só do laboratório
  assert.equal(hb.unidade, 'g/dL')
  assert.equal(hb.referencia, '12-16')
  assert.deepEqual(hb.celulas[0], { valor: '11,0', marca: null, critico: false, manual: true })
  assert.deepEqual(hb.celulas[1], { valor: '10,4', marca: 'L', critico: false, manual: false })
  assert.equal(p.grupos[0].linhas[1].celulas[0], null)
  assert.equal(p.grupos[1].linhas[0].celulas[1]?.critico, true)
})

test('planilha: lançamento à mão não traz unidade nem faixa', () => {
  const p = montarPlanilha([res({ origem: 'manual', itens: [item('Lactato', '3,2', { unidade: 'mmol/L', referencia: 'x', marca: 'H', critico: true })] })])
  assert.equal(p.grupos[0].linhas[0].unidade, null)
  assert.equal(p.grupos[0].linhas[0].referencia, null)
  assert.deepEqual(p.grupos[0].linhas[0].celulas[0], { valor: '3,2', marca: null, critico: false, manual: true })
})

test('lançamento à mão: nome e valor, sem repetir', () => {
  assert.deepEqual(itensDoLancamento([{ analito: ' Hb ', valor: ' 10 ' }, { analito: '', valor: '' }]), { itens: [{ analito: 'Hb', valor: '10' }], erro: null })
  assert.equal(itensDoLancamento([{ analito: 'Hb', valor: '' }]).erro, 'Falta o valor de Hb.')
  assert.equal(itensDoLancamento([{ analito: '', valor: '3' }]).erro, 'Falta o nome do parâmetro do valor 3.')
  assert.equal(itensDoLancamento([{ analito: 'Hb', valor: '1' }, { analito: 'hb', valor: '2' }]).erro, 'hb aparece duas vezes.')
  assert.equal(itensDoLancamento([]).erro, 'Informe ao menos um valor.')
})

test('parâmetros conhecidos vêm do próprio paciente', () => {
  const r = [res({ itens: [item('Hemoglobina', '1'), item('Plaquetas', '2')] }), res({ exame: 'Sódio', itens: [item('Sódio', '3')] })]
  assert.deepEqual(analitosConhecidos(r), ['Hemoglobina', 'Plaquetas', 'Sódio'])
  assert.deepEqual(analitosConhecidos(r, 'sódio'), ['Sódio'])
})

test('hora da coleta do campo, no fuso de Brasília', () => {
  assert.equal(instanteDoCampo('2026-11-25T08:30'), '2026-11-25T11:30:00.000Z')
  assert.equal(instanteDoCampo(''), null)
})

test('um arquivo para vários exames: um envio por setor', () => {
  const e = [{ id: 'a', grupo: 'laboratorio' as const }, { id: 'b', grupo: 'imagem' as const }, { id: 'c', grupo: 'laboratorio' as const }]
  assert.deepEqual(envioPorSetor(e), [{ grupo: 'laboratorio', ids: ['a', 'c'] }, { grupo: 'imagem', ids: ['b'] }])
})
