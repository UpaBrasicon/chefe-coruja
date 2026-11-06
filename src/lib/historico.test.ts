// node --experimental-strip-types --test src/lib/historico.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { INICIAIS_HISTORICO, agruparPorAno, motivoValido, resumoHistorico, rotuloDesfechoFinal, type AtendimentoEncerrado } from './historico.ts'

test('desfecho final por extenso, da porta e da internação', () => {
  assert.equal(rotuloDesfechoFinal('alta_melhorada'), 'Alta')
  assert.equal(rotuloDesfechoFinal('alta_evasao'), 'Evasão')
  assert.equal(rotuloDesfechoFinal('alta_apos_medicacao'), 'Alta após medicação')
  assert.equal(rotuloDesfechoFinal(null), 'Encerrado')
  assert.equal(rotuloDesfechoFinal('algo_novo'), 'algo novo')
})

test('motivo com 10 letras ou mais, como no banco', () => {
  assert.equal(motivoValido('curto'), false)
  assert.equal(motivoValido('   1234567890  '), true)
})

// Item 7 dos achados guardados (A em H1 a H5, 06/11/2026): os 5 mais recentes,
// resumo por desfecho e o resto agrupado por ano.
const at = (id: string, chegada: string, desfecho: string | null = 'alta'): AtendimentoEncerrado => ({
  id, chegada_em: chegada, encerrado_em: null, setor: 'PS', cor: null, desfecho, cid: null, medico: null,
})

test('cinco aparecem de início', () => {
  assert.equal(INICIAIS_HISTORICO, 5)
})

test('resumo: total, contagem por rótulo de desfecho e o último', () => {
  assert.deepEqual(resumoHistorico([]), { total: 0, porDesfecho: [], ultimo: null })
  const r = resumoHistorico([
    at('a', '2026-11-01T12:00:00Z', 'alta_melhorada'),
    at('b', '2026-10-01T12:00:00Z', 'alta'),
    at('c', '2026-09-01T12:00:00Z', 'obito'),
    at('d', '2026-08-01T12:00:00Z', null),
  ])
  assert.equal(r.total, 4)
  assert.equal(r.ultimo, '2026-11-01T12:00:00Z')
  // alta_melhorada e alta têm o mesmo rótulo; ordem: mais frequente, depois alfabética
  assert.deepEqual(r.porDesfecho, [
    { rotulo: 'Alta', quantidade: 2 },
    { rotulo: 'Encerrado', quantidade: 1 },
    { rotulo: 'Óbito', quantidade: 1 },
  ])
})

test('agrupa por ano, do mais recente ao mais antigo, mantendo a ordem dentro do ano', () => {
  assert.deepEqual(agruparPorAno([]), [])
  const g = agruparPorAno([
    at('a', '2026-03-01T12:00:00Z'), at('b', '2026-01-10T12:00:00Z'),
    at('c', '2025-12-20T12:00:00Z'), at('d', '2024-05-05T12:00:00Z'),
  ])
  assert.deepEqual(g.map((x) => [x.ano, x.itens.map((i) => i.id)]), [[2026, ['a', 'b']], [2025, ['c']], [2024, ['d']]])
})

test('o ano é o de Brasília: chegada às 01:00 UTC de 1º de janeiro ainda é 31/12', () => {
  const g = agruparPorAno([at('a', '2026-01-01T01:00:00Z')])
  assert.equal(g[0].ano, 2025)
})
