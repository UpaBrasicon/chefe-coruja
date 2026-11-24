// node --experimental-strip-types --test src/lib/observacaoLista.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acaoPrincipal, haQuanto, horaMais, ordenarObservacao, situacaoObservacao, tempoNaObservacao } from './observacaoLista.ts'

const agora = Date.parse('2026-11-24T15:00:00Z')

test('situação em palavras do plantão', () => {
  assert.equal(situacaoObservacao('nao').rotulo, 'Não atendido')
  assert.equal(situacaoObservacao('atendimento').rotulo, 'Em conduta')
  assert.equal(situacaoObservacao('reavaliacao', { examePendente: true }).rotulo, 'Aguardando exame')
  assert.equal(situacaoObservacao('encaminhado').rotulo, 'Aguardando regulação')
})

test('um tempo só, com data quando passa de 24 h', () => {
  assert.equal(haQuanto(45), 'há 45 min')
  assert.equal(haQuanto(320), 'há 5 h 20 min')
  assert.equal(haQuanto(45 * 1440 + 15 * 60), 'há 45 d 15 h')
  const t = tempoNaObservacao('2026-11-20T12:00:00Z', agora)
  assert.match(t.desde, /^desde \d{2}\/\d{2}\/\d{4}/)
  assert.match(tempoNaObservacao('2026-11-24T14:00:00Z', agora).desde, /^desde \d{2}:\d{2}$/)
})

test('ação principal conforme a situação', () => {
  assert.equal(acaoPrincipal('nao'), 'atender')
  assert.equal(acaoPrincipal('reavaliacao'), 'conduta')
  assert.equal(acaoPrincipal('finalizado'), null)
})

test('vencidos primeiro, depois quem chegou antes', () => {
  const l = ordenarObservacao([
    { id: 'a', entrada: '2026-11-24T13:00:00Z', prazo: '2026-11-24T19:00:00Z' },
    { id: 'b', entrada: '2026-11-24T08:30:00Z', prazo: '2026-11-24T14:30:00Z' },
    { id: 'c', entrada: '2026-11-24T10:00:00Z', prazo: '2026-11-24T16:00:00Z' },
  ], agora)
  assert.deepEqual(l.map((x) => x.id), ['b', 'c', 'a'])
})

test('atalho de reavaliação dá a hora final', () => {
  assert.match(horaMais(agora, 30), /^\d{2}:\d{2}$/)
})
