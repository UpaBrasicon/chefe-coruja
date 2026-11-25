// node --experimental-strip-types --test src/lib/avisosNir.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { acaoDoAviso, linhasDeAvisos, motivoDoAviso, numeroDoPedido } from './avisosNir.ts'
import { pacientes, prazoVencido, separarParaNir, type PacienteRegulacao, type PedidoResumo } from './regulacaoPaciente.ts'
import type { Sla } from './regulacao.ts'

const aviso = (id: string, tipo: string, mensagem: string, dia: string, lida = false) => ({ id, tipo, mensagem, lida, created_at: `2026-11-${dia}T09:00:00Z` })

test('NI1: número do pedido, motivo curto e a ação do aviso', () => {
  assert.equal(numeroDoPedido('reg_prazo_72h_1'), 1)
  assert.equal(numeroDoPedido('reg_prazo_evolucao_12'), 12)
  assert.equal(numeroDoPedido('farm_devolvido'), null)
  assert.equal(motivoDoAviso('Regulação nº 1: 72 h sem evolução; a central pode cancelar o pedido. Atualize a evolução.'), '72 h sem evolução')
  assert.equal(motivoDoAviso('Regulação nº 3: a evolução do paciente passou de 12 h. Atualize no pedido.'), 'a evolução do paciente passou de 12 h')
  assert.equal(acaoDoAviso('reg_prazo_72h_1'), 'evolucao')
  assert.equal(acaoDoAviso('reg_prazo_pendencia_4'), 'responder')
  assert.equal(acaoDoAviso('reg_destino_aceitou'), 'abrir')
  assert.equal(acaoDoAviso('turno_inicio'), null)
})

test('NI1: os avisos repetidos do mesmo pedido viram uma linha só', () => {
  const msg = 'Regulação nº 1: 72 h sem evolução; a central pode cancelar o pedido. Atualize a evolução.'
  const lista = [
    ...Array.from({ length: 30 }, (_, i) => aviso(`a${i}`, 'reg_prazo_72h_1', msg, String(14 + (i % 10)).padStart(2, '0'))),
    aviso('lido', 'reg_prazo_72h_1', msg, '24', true),
    aviso('b1', 'reg_prazo_evolucao_2', 'Regulação nº 2: a evolução do paciente passou de 12 h. Atualize no pedido.', '20'),
    aviso('c1', 'leito_livre', 'Leito 3 liberado.', '22'), aviso('c2', 'leito_livre', 'Leito 3 liberado.', '23'),
  ]
  const linhas = linhasDeAvisos(lista)
  assert.equal(linhas.length, 3)
  const um = linhas.find((l) => l.numero === 1)!
  assert.equal(um.vezes, 30)
  assert.equal(um.naoLidos.length, 30, 'marcar como lidos leva o grupo inteiro, sem o já lido')
  assert.equal(um.motivo, '72 h sem evolução')
  assert.equal(um.desde.slice(0, 10), '2026-11-14')
  assert.equal(um.acao, 'evolucao')
  assert.equal(linhas.find((l) => l.numero === null)!.vezes, 2)
})

const sla = (x: Partial<Sla>): Sla => ({
  fila: { prazo_min: null, central_seg: 0, correndo: false, atrasado: false }, pendencia: null, evolucao: null,
  atrasado_central: false, atrasado_origem: false, ...x,
} as Sla)
const pedido = (x: Partial<PedidoResumo> = {}): PedidoResumo => ({
  id: 'p', numero: 1, status: 'enviada', tipo: 'leito', carater: 'urgencia', prioridade: 'urgencia', prioridade_regulador: null,
  especialidade: null, procedimento: null, procedimento_nome: null, tipo_leito: 'uti_adulto', transporte: null, cid: 'I21.9',
  destino: null, criada_em: '2026-11-24T10:00:00Z', em_aberto: true, pendencia_pergunta: null, pendencia_em: null,
  motivo_devolucao: null, sla: null, conversa: { total: 0, novas: 0, aguardando: [] }, ...x,
})
const paciente = (nome: string, pedidos: PedidoResumo[] = []): PacienteRegulacao => ({
  paciente: { id: nome, nome, nascimento: null }, internacao: null, setor: { id: 's', nome: 'Clínica' }, leito: null, pedidos,
})

test('NI2: em regulação primeiro, prazo vencido no topo; sem regulação à parte', () => {
  const lista = [
    paciente('A'), paciente('B', [pedido()]), paciente('C'),
    paciente('D', [pedido({ status: 'pendencia' })]), paciente('E', [pedido({ sla: sla({ atrasado_origem: true }) })]),
    paciente('F', [pedido({ em_aberto: false })]),
  ]
  const r = separarParaNir(lista)
  assert.deepEqual(r.emRegulacao.map((l) => l.paciente.nome), ['E', 'D', 'B'])
  assert.deepEqual(r.semRegulacao.map((l) => l.paciente.nome), ['A', 'C', 'F'])
  assert.ok(prazoVencido(lista[4]))
  assert.ok(!prazoVencido(paciente('G', [pedido({ em_aberto: false, sla: sla({ atrasado_origem: true }) })])), 'pedido encerrado não conta')
})

test('NI2: plural certo', () => {
  assert.equal(pacientes(1), '1 paciente')
  assert.equal(pacientes(3), '3 pacientes')
})
