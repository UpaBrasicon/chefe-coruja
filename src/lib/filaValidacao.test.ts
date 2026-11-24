// Revisão do perfil Farmacêutico (FA1, FA2, VA2 e VA3), RT 24/11/2026.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { agruparPorPaciente, contarFila, doseNaoInformada, separarVencidos, type ItemDaFila } from './filaValidacao.ts'
import { agruparNavegacao, itensDeNavegacao } from '../components/casca/navegacao.ts'

const item = (x: Partial<ItemDaFila> & { item_id: string }): ItemDaFila => ({
  paciente_nome: 'Ana', local: null, alta_vigilancia: false, prescrito_em: '2026-11-24T10:00:00Z', validade: 'em_dia', ...x,
})

test('FA1: a fila conta só o que se valida (o item de prescrição vencida fica fora)', () => {
  const fila = [item({ item_id: 'a' }), item({ item_id: 'b', validade: 'vencido' }), item({ item_id: 'c', validade: 'sem_prazo' }), item({ item_id: 'd', validade: null })]
  assert.equal(contarFila(fila), 3)
  assert.equal(contarFila(null), 0)
  const { aValidar, vencidos } = separarVencidos(fila)
  assert.deepEqual(aValidar.map((i) => i.item_id), ['a', 'c', 'd'])
  assert.deepEqual(vencidos.map((i) => i.item_id), ['b'])
})

test('VA2: um paciente por linha, mesmo com prescrições e locais diferentes', () => {
  const fila = [
    item({ item_id: 'cef', paciente_nome: 'João', local: 'CM-1' }),
    item({ item_id: 'dip', paciente_nome: 'João', local: 'Observação' }),
  ]
  const grupos = agruparPorPaciente(fila, null, new Map([['cef', 'p1'], ['dip', 'p1']]))
  assert.equal(grupos.length, 1)
  assert.deepEqual(grupos[0].locais, ['CM-1', 'Observação'])
  assert.equal(grupos[0].itens.length, 2)
})

test('VA2: sem o id do paciente, junta pelo nome; com o id, homônimos ficam separados', () => {
  const fila = [item({ item_id: 'x', paciente_nome: 'Maria' }), item({ item_id: 'y', paciente_nome: 'Maria' })]
  assert.equal(agruparPorPaciente(fila, null).length, 1)
  assert.equal(agruparPorPaciente(fila, null, new Map([['x', 'p1'], ['y', 'p2']])).length, 2)
})

test('VA2: alta vigilância e controlado primeiro, depois o mais antigo', () => {
  const fila = [
    item({ item_id: 'antigo', paciente_nome: 'Antigo', prescrito_em: '2026-11-24T06:00:00Z' }),
    item({ item_id: 'av', paciente_nome: 'AV', prescrito_em: '2026-11-24T12:00:00Z', alta_vigilancia: true }),
    item({ item_id: 'ctrl', paciente_nome: 'Controlado', prescrito_em: '2026-11-24T09:00:00Z' }),
    item({ item_id: 'novo', paciente_nome: 'Novo', prescrito_em: '2026-11-24T11:00:00Z' }),
  ]
  const grupos = agruparPorPaciente(fila, new Set(['ctrl']))
  assert.deepEqual(grupos.map((g) => g.paciente), ['Controlado', 'AV', 'Antigo', 'Novo'])
  // dentro do paciente, a mesma ordem
  const um = agruparPorPaciente([
    item({ item_id: 'comum', prescrito_em: '2026-11-24T01:00:00Z' }),
    item({ item_id: 'morfina', prescrito_em: '2026-11-24T05:00:00Z', alta_vigilancia: true }),
  ], null)
  assert.deepEqual(um[0].itens.map((i) => i.item_id), ['morfina', 'comum'])
  assert.equal(um[0].desde, '2026-11-24T01:00:00Z')
})

test('VA3: dose explícita é número e unidade; texto livre ou vazio pede o aviso', () => {
  for (const d of ['1 g', '500 mg', '2,5 mL', '10 UI', '1 comprimido', '20 gotas', '4mg', '0.1 mg/kg', '1 ampola']) assert.equal(doseNaoInformada(d), false, d)
  for (const d of [null, undefined, '', '  ', 'diluir com 9 ml de ad e fazer 3 ml iv lento', 'conforme protocolo', 'meia ampola'])
    assert.equal(doseNaoInformada(d), true, String(d))
})

test('FA2: o menu do farmacêutico em grupos: Trabalho, Segurança, Estoque e Equipe', () => {
  const blocos = agruparNavegacao(itensDeNavegacao('farmaceutico', false, false, 'upa'))
  assert.deepEqual(blocos.map((b) => [b.grupo, b.itens.map((i) => i.rotulo)]), [
    ['Trabalho', ['Central do Farmacêutico', 'Dispensação']],
    ['Segurança', ['Alta vigilância', 'Interações críticas']],
    ['Estoque', ['Unidade de consumo', 'Materiais']],
    ['Equipe', ['Escala']],
  ])
  // na UBS os materiais (conta da porta e da internação) saem
  assert.ok(!itensDeNavegacao('farmaceutico', false, false, 'ubs').some((i) => i.to === '/faturamento/materiais'))
})
