// node --experimental-strip-types --test src/clinico/pediatria/choqueToxicoPartesMolesPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { DOSES_PELE, DOSES_SCT, fichaChoqueToxicoPartesMoles, sctEstafilococica, sctEstreptococica } from './choqueToxicoPartesMolesPed.ts'

test('SCT estafilocócica (Tabela 2, p. 473–474)', () => {
  assert.equal(temReferenciaPediatrica(fichaChoqueToxicoPartesMoles), true)
  assert.deepEqual(sctEstafilococica(new Set(['febre', 'rash', 'hipotensao']), 3, true), { nClinicos: 4, caso: 'provável' })
  assert.deepEqual(sctEstafilococica(new Set(['febre', 'rash', 'hipotensao', 'descamacao']), 3, true), { nClinicos: 5, caso: 'confirmado' })
  assert.deepEqual(sctEstafilococica(new Set(['febre', 'rash', 'hipotensao', 'multissistemico']), 2, true), { nClinicos: 3, caso: 'não preenche' })
  assert.equal(sctEstafilococica(new Set(['febre', 'rash', 'hipotensao', 'descamacao']), 3, false).caso, 'não preenche')
})

test('SCT estreptocócica (Tabela 3, p. 473–474)', () => {
  assert.equal(sctEstreptococica(true, 2, 'esteril'), 'confirmado')
  assert.equal(sctEstreptococica(true, 2, 'nao-esteril'), 'provável')
  assert.equal(sctEstreptococica(true, 1, 'esteril'), 'não preenche')
  assert.equal(sctEstreptococica(false, 3, 'esteril'), 'não preenche')
})

test('doses: Figura 1 do cap. 46 e Apêndice', () => {
  const pen = calcularDoseLivro(DOSES_SCT.find((d) => d.id === 'penicilina')!, 80)!
  assert.deepEqual(pen.dia, [16_000_000, 24_000_000])
  assert.equal(pen.noMaximo, true)
  assert.deepEqual(calcularDoseLivro(DOSES_SCT.find((d) => d.id === 'clindamicina')!, 20)!.dia, [500, 800])
  const oxa = calcularDoseLivro(DOSES_PELE.find((d) => d.id === 'oxacilina')!, 20)!
  assert.deepEqual(oxa.dia, [2000, 4000])
  assert.equal(oxa.noMaximo, false)
  assert.deepEqual(calcularDoseLivro(DOSES_PELE.find((d) => d.id === 'doxi')!, 60)!.porDose, [66, 100])
})
