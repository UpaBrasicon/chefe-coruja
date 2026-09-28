// node --experimental-strip-types --test src/clinico/pediatria/bronquiolite.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { criteriosPalivizumabe, fichaBronquiolite, fluxoCnafLMin, indicacoesPresentes } from './bronquiolite.ts'

test('CNAF 1 a 2 L/kg/min (p. 303)', () => {
  assert.equal(temReferenciaPediatrica(fichaBronquiolite), true)
  assert.deepEqual(fluxoCnafLMin(6), [6, 12])
  assert.equal(fluxoCnafLMin(0), null)
})

test('internação: FR > 70 entra como indicação (p. 302)', () => {
  assert.deepEqual(indicacoesPresentes(new Set(), 70), [])
  assert.equal(indicacoesPresentes(new Set(), 71).length, 1)
  assert.equal(indicacoesPresentes(new Set(['apneia', 'hipoxemia']), null).length, 2)
})

test('palivizumabe (p. 304)', () => {
  assert.equal(criteriosPalivizumabe({ idadeMeses: 8, igSemanas: 28, dpc: false, cardiopatia: false }).length, 1)
  assert.equal(criteriosPalivizumabe({ idadeMeses: 8, igSemanas: 29, dpc: false, cardiopatia: false }).length, 0)
  assert.equal(criteriosPalivizumabe({ idadeMeses: 12, igSemanas: 27, dpc: false, cardiopatia: false }).length, 0)
  assert.equal(criteriosPalivizumabe({ idadeMeses: 20, igSemanas: null, dpc: false, cardiopatia: true }).length, 1)
  assert.equal(criteriosPalivizumabe({ idadeMeses: 25, igSemanas: null, dpc: true, cardiopatia: false }).length, 0)
})
