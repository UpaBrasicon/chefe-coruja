import { test } from 'node:test'
import assert from 'node:assert/strict'

import { emRegulacao, esperaAOrigem, mensagensNovas, ordenarPorAcao, porSetor, rotuloAguardando, SEM_SETOR,
  type PacienteRegulacao, type PedidoResumo } from './regulacaoPaciente.ts'

const pedido = (x: Partial<PedidoResumo> = {}): PedidoResumo => ({
  id: 'p', numero: 1, status: 'enviada', tipo: 'leito', carater: 'urgencia', prioridade: 'urgencia', prioridade_regulador: null,
  especialidade: null, procedimento: null, procedimento_nome: null, tipo_leito: 'uti_adulto', transporte: null, cid: 'I21.9',
  destino: null, criada_em: '2026-11-24T10:00:00Z', em_aberto: true, pendencia_pergunta: null, pendencia_em: null,
  motivo_devolucao: null, sla: null, conversa: { total: 0, novas: 0, aguardando: [] }, ...x,
})
const paciente = (nome: string, setor: string | null, pedidos: PedidoResumo[] = []): PacienteRegulacao => ({
  paciente: { id: nome, nome, nascimento: null }, internacao: null, setor: setor ? { id: setor, nome: setor } : null, leito: null, pedidos,
})

test('a origem deve resposta: pendência, devolvido ou mensagem da central sem resposta', () => {
  assert.equal(esperaAOrigem(pedido()), false)
  assert.equal(esperaAOrigem(pedido({ status: 'pendencia' })), true)
  assert.equal(esperaAOrigem(pedido({ status: 'devolvida' })), true)
  assert.equal(esperaAOrigem(pedido({ conversa: { total: 1, novas: 0, aguardando: [{ texto: 'ECG?', intencao: 'pedido', em: '', autor: null }] } })), true)
})

test('mensagens novas somam os pedidos do paciente', () => {
  const l = paciente('A', null, [pedido({ conversa: { total: 2, novas: 2, aguardando: [] } }), pedido({ conversa: { total: 1, novas: 1, aguardando: [] } })])
  assert.equal(mensagensNovas(l), 3)
})

test('lista do médico: só quem tem pedido em aberto', () => {
  const lista = [paciente('A', 'UTI'), paciente('B', 'UTI', [pedido({ em_aberto: false })]), paciente('C', null, [pedido()])]
  assert.deepEqual(emRegulacao(lista).map((l) => l.paciente.nome), ['C'])
})

test('por setor, em ordem de nome, com a porta no fim', () => {
  const g = porSetor([paciente('A', null), paciente('B', 'Sala amarela'), paciente('C', 'Enfermaria'), paciente('D', 'Enfermaria')])
  assert.deepEqual(g.map((x) => x.setor), ['Enfermaria', 'Sala amarela', SEM_SETOR])
  assert.deepEqual(g[0].pacientes.map((l) => l.paciente.nome), ['C', 'D'])
})

test('quem pede ação vem antes de quem tem mensagem nova', () => {
  const lista = [paciente('A', 'X', [pedido()]), paciente('B', 'X', [pedido({ conversa: { total: 1, novas: 1, aguardando: [] } })]),
    paciente('C', 'X', [pedido({ status: 'pendencia' })])]
  assert.deepEqual(ordenarPorAcao(lista).map((l) => l.paciente.nome), ['C', 'B', 'A'])
})

test('rótulo do que o regulador espera', () => {
  assert.equal(rotuloAguardando({ intencao: 'pergunta' }), 'Pergunta do regulador')
  assert.equal(rotuloAguardando({ intencao: 'pedido' }), 'O regulador pede')
  assert.equal(rotuloAguardando({ intencao: 'mensagem' }), 'Mensagem do regulador')
})
