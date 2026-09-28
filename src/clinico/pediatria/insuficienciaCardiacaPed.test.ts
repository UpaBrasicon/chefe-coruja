// node --experimental-strip-types --test src/clinico/pediatria/insuficienciaCardiacaPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { DOSES_IC_ORAIS, ISHLT, ROSS, fichaInsuficienciaCardiacaPed, indiceCardiotoracico, levosimendana } from './insuficienciaCardiacaPed.ts'

const d = (id: string) => DOSES_IC_ORAIS.find((x) => x.id === id)!

test('Tabela 6 (p. 239–240): doses por peso', () => {
  assert.equal(temReferenciaPediatrica(fichaInsuficienciaCardiacaPed), true)
  assert.deepEqual(calcularDoseLivro(d('furosemida'), 8)!.porDose, [4, 16])
  assert.deepEqual(calcularDoseLivro(d('espironolactona'), 10)!.porDose, [5, 15])
  assert.deepEqual(calcularDoseLivro(d('enalapril'), 20)!.dia, [2, 10])
  assert.deepEqual(calcularDoseLivro(d('digoxina-menor2'), 10)!.porDose, [50, 50])
  assert.deepEqual(calcularDoseLivro(d('digoxina-maior2'), 14)!.dia, [70, 140])
  assert.equal(calcularDoseLivro(d('metoprolol'), 10)!.porDose, null)
})

test('levosimendana: ataque 8–12 µg/kg, manutenção 0,1–0,2 µg/kg/min (p. 240)', () => {
  assert.deepEqual(levosimendana(10), { ataqueMcg: [80, 120], manutencaoMcgMin: [1, 2] })
})

test('índice cardiotorácico (A + B) / C, com as medidas da Figura 3 (p. 237)', () => {
  const r = indiceCardiotoracico(58.7, 100.8, 288.8, false)!
  assert.ok(Math.abs(r.ict - 0.5523) < 1e-3)
  assert.equal(r.acima, true)
  assert.equal(indiceCardiotoracico(58.7, 100.8, 288.8, true)!.acima, false)
  assert.equal(indiceCardiotoracico(0, 1, 1, false), null)
  assert.equal(ROSS.length, 4)
  assert.equal(ISHLT.length, 4)
})
