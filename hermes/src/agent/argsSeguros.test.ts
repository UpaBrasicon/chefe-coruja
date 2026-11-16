import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reidentificar, criarCofre, desidentificar } from '../gateway/desidentificacao.js'
import { argsParaAuditoria, argsParaLog, prefixoDeNotificacao } from './argsSeguros.js'

test('S8 D2: auditoria guarda id, data, número e enumeração; texto livre vira resumo', () => {
  const r = argsParaAuditoria({
    paciente_id: '21000000-0000-4000-8000-000000000001', data: '2026-11-15', dias: 7, ativo: true,
    status: 'novo', nome: 'Maria da Silva', filtro: { texto: 'x' }, vazio: null,
  })
  assert.equal(r.paciente_id, '21000000-0000-4000-8000-000000000001')
  assert.equal(r.data, '2026-11-15')
  assert.equal(r.dias, 7)
  assert.equal(r.ativo, true)
  assert.equal(r.status, 'novo')
  assert.equal(r.vazio, null)
  assert.match(String(r.nome), /^sha256:[0-9a-f]{16}$/)
  assert.ok(!JSON.stringify(r).includes('Maria'))
  assert.match(String(r.filtro), /^sha256:/)
})

test('S8 D2: log leva só os nomes dos campos', () => {
  assert.deepEqual(argsParaLog({ nome: 'Maria da Silva', dias: 3 }), ['nome', 'dias'])
})

test('S8 D3: notificação com outro prefixo não é reidentificada pelo cofre da conversa', () => {
  const conversa = criarCofre()
  // o gateway já deu [PESSOA_1] a quem pergunta
  desidentificar('Sou Ana Paula Souza', conversa, [{ valor: 'Ana Paula Souza', categoria: 'PESSOA' }])
  const notif = prefixoDeNotificacao('[PESSOA_1] e [PESSOA_2] sem check-in; ligar [TELEFONE_1]')
  assert.equal(notif, '[COLEGA_1] e [COLEGA_2] sem check-in; ligar [NOTIF_TELEFONE_1]')
  assert.equal(reidentificar(notif, conversa), notif)
})
