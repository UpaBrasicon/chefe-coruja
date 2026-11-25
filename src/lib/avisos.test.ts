// node --experimental-strip-types --test src/lib/avisos.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agruparAvisos, categoria, contarNaoLidos, precisaAcao, type Aviso } from './avisos.ts'

const aviso = (id: string, tipo: string, mensagem: string, created_at: string, lida = false): Aviso => ({ id, tipo, mensagem, lida, created_at })

test('prescrição vencida tem categoria própria e pede ação', () => {
  assert.equal(categoria('presc_vencida_9f1c', 'Prescrição vencida às 23/11 10:00: dipirona'), 'Prescrição')
  assert.equal(categoria('outro', 'Prescrição vencida às 23/11 10:00: dipirona'), 'Prescrição', 'pelo texto, se o tipo não disser')
  assert.equal(categoria('nir_aih_laudo'), 'AIH')
  assert.equal(categoria('qualquer'), 'Outros')
  assert.ok(precisaAcao('presc_vence_9f1c'))
  assert.ok(precisaAcao('reg_prazo_72h_1'))
  assert.ok(!precisaAcao('vaga_123'))
  assert.ok(!precisaAcao('noite_inicio'))
})

test('avisos repetidos viram uma linha e o contador conta grupos', () => {
  const msg = 'Regulação nº 1: 72 h sem evolução; a central pode cancelar o pedido. Atualize a evolução.'
  const lista = [
    aviso('a', 'reg_prazo_72h_1', msg, '2026-11-17T10:00:00Z'),
    aviso('b', 'reg_prazo_72h_1', msg, '2026-11-18T10:00:00Z', true),
    aviso('c', 'reg_prazo_72h_1', msg, '2026-11-19T10:00:00Z'),
    aviso('d', 'vaga_1', 'Vaga aberta na noite de 25/11', '2026-11-20T10:00:00Z'),
  ]
  const g = agruparAvisos(lista)
  assert.equal(g.length, 2)
  assert.equal(g[0].tipo, 'vaga_1', 'mais novo primeiro')
  assert.deepEqual({ vezes: g[1].vezes, naoLidos: g[1].naoLidos, primeiro: g[1].primeiro, acao: g[1].acao },
    { vezes: 3, naoLidos: ['a', 'c'], primeiro: '2026-11-17T10:00:00Z', acao: true })
  assert.equal(contarNaoLidos(lista), 2)
  assert.equal(contarNaoLidos(lista.map((x) => ({ ...x, lida: true }))), 0)
})
