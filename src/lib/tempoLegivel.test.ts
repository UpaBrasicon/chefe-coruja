// node --experimental-strip-types --test src/lib/tempoLegivel.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { minutosLegiveis, textoComTempoLegivel } from './tempoLegivel.ts'

test('minutos em forma legível', () => {
  assert.equal(minutosLegiveis(45), '45 min')
  assert.equal(minutosLegiveis(60), '1 h')
  assert.equal(minutosLegiveis(200), '3 h 20 min')
  assert.equal(minutosLegiveis(1440), '1 dia')
  assert.equal(minutosLegiveis(64707), '44 dias')
})

test('texto do apontamento: só troca o que passa de uma hora', () => {
  assert.equal(textoComTempoLegivel('Evolução 64707 min além do prazo'), 'Evolução 44 dias além do prazo')
  assert.equal(textoComTempoLegivel('atraso de 15 min'), 'atraso de 15 min')
  assert.equal(textoComTempoLegivel('90 minutos sem check-in'), '1 h 30 min sem check-in')
})
