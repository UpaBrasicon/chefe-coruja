// node --experimental-strip-types --test src/lib/escalaSeguida.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blocosAcimaDoLimite, blocosSeguidos, type PlantaoNoTempo } from './escalaSeguida.ts'

// manhã 07–13, tarde 13–19, noite 19–07 (horário de Brasília)
const p = (id: string, data: string, h: string, duracao_min: number): PlantaoNoTempo =>
  ({ id, data, inicio: `${data}T${h}:00-03:00`, duracao_min })

test('plantões encostados viram um bloco e somam as horas', () => {
  const b = blocosSeguidos([p('n', '2026-11-01', '19:00', 720), p('m', '2026-11-01', '07:00', 360), p('t', '2026-11-01', '13:00', 360)])
  assert.equal(b.length, 1)
  assert.equal(b[0].horas, 24)
  assert.deepEqual(b[0].ids, ['m', 't', 'n'])
})

test('só passa do limite quem fica mais de 24 h seguidas', () => {
  const dia = (d: string) => [p(`${d}m`, d, '07:00', 360), p(`${d}t`, d, '13:00', 360), p(`${d}n`, d, '19:00', 720)]
  assert.equal(blocosAcimaDoLimite(dia('2026-11-01')).length, 0, '24 h exatas não passam')
  const quatro = blocosAcimaDoLimite([...dia('2026-11-01'), ...dia('2026-11-02'), ...dia('2026-11-03'), ...dia('2026-11-04')])
  assert.equal(quatro.length, 1)
  assert.equal(quatro[0].horas, 96)
  assert.deepEqual(quatro[0].datas, ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'])
  assert.equal(blocosAcimaDoLimite([p('a', '2026-11-01', '07:00', 360), p('b', '2026-11-01', '19:00', 720)]).length, 0, 'com intervalo, não junta')
})
