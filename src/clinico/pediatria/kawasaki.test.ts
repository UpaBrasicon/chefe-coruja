// node --experimental-strip-types --test src/clinico/pediatria/kawasaki.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { DOSES_KAWASAKI, classificarZ, fichaKawasaki, lerCriterios, lerIncompleta, velocidadeIvigMlH } from './kawasaki.ts'

const d = (id: string) => DOSES_KAWASAKI.find((x) => x.id === id)!

test('critérios clássicos e forma incompleta (p. 747–748)', () => {
  assert.equal(temReferenciaPediatrica(fichaKawasaki), true)
  assert.equal(lerCriterios(5, 4, 24)!.classica, true)
  assert.equal(lerCriterios(4, 4, 24)!.quartoDia, true)
  assert.equal(lerCriterios(5, 3, 24)!.incompletaAvaliar, true)
  assert.equal(lerCriterios(7, 0, 4)!.incompletaAvaliar, true)
  assert.equal(lerCriterios(6, 1, 24)!.incompletaAvaliar, false)
  assert.equal(lerCriterios(5, 6, 24), null)
})

test('Figura 1: PCR/VHS e alterações laboratoriais', () => {
  assert.equal(lerIncompleta(2, 30, 5), 'inflamacao-baixa')
  assert.equal(lerIncompleta(3, 30, 3), 'tratar-lab')
  assert.equal(lerIncompleta(1, 40, 2), 'depende-eco')
})

test('Z-score (p. 749–750)', () => {
  assert.equal(classificarZ(1.5), 'normal')
  assert.equal(classificarZ(2.2), 'dilatacao')
  assert.equal(classificarZ(2.5), 'aneurisma-pequeno')
  assert.equal(classificarZ(5), 'aneurisma-medio')
  assert.equal(classificarZ(10), 'aneurisma-gigante')
  assert.equal(classificarZ(6, 9), 'aneurisma-gigante')
  assert.equal(classificarZ(-3), 'abaixo')
})

test('doses (Tabela 1, p. 750–751)', () => {
  assert.deepEqual(calcularDoseLivro(d('ivig'), 12)!.porDose, [24, 24])
  assert.deepEqual(calcularDoseLivro(d('aas-alta'), 12)!.dia, [360, 600])
  assert.deepEqual(calcularDoseLivro(d('aas-baixa'), 12)!.dia, [36, 60])
  assert.deepEqual(calcularDoseLivro(d('aas-baixa'), 30)!.dia, [90, 100])
  assert.deepEqual(calcularDoseLivro(d('metilpred-pulso'), 40)!.porDose, [1000, 1000])
  assert.deepEqual(calcularDoseLivro(d('infliximabe'), 12)!.porDose, [60, 60])
  assert.deepEqual(velocidadeIvigMlH(10), { inicial: 6, maxima: 48 })
})
