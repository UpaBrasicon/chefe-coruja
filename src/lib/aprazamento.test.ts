// node --experimental-strip-types --test src/lib/aprazamento.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { horariosPorIntervalo, lerHorarios, mesmaLista } from './aprazamento.ts'

test('lê os horários digitados', () => {
  assert.deepEqual(lerHorarios('20:00, 08:00'), { horarios: ['08:00', '20:00'], invalidos: [] })
  assert.deepEqual(lerHorarios('8 16h 0:30'), { horarios: ['00:30', '08:00', '16:00'], invalidos: [] })
  assert.deepEqual(lerHorarios('25:00, 8:00, 8:00'), { horarios: ['08:00'], invalidos: ['25:00'] })
})

test('grade pelo início, igual à do banco', () => {
  assert.deepEqual(horariosPorIntervalo('06:00', 8), ['06:00', '14:00', '22:00'])
  assert.deepEqual(horariosPorIntervalo('22:30', 6), ['04:30', '10:30', '16:30', '22:30'])
  assert.deepEqual(horariosPorIntervalo('06:00', 24), ['06:00'])
})

test('compara listas sem ordem', () => {
  assert.equal(mesmaLista(['14:00', '06:00'], ['06:00', '14:00']), true)
  assert.equal(mesmaLista(['06:00'], ['06:00', '18:00']), false)
  assert.equal(mesmaLista(null, []), true)
})
