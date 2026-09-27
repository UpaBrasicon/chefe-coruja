// node --experimental-strip-types --test src/clinico/escores/ranson.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { ranson } from './ranson.ts'

const ADM = ['idade', 'leuco', 'glicemia', 'ldh', 'ast']
/** Admissão: presentes pelo id, demais "Não". 48 h: marcas ligadas. */
const r = (adm: string[], h48: string[] = []): Respostas => ({
  ...Object.fromEntries(ADM.map((k) => [k, adm.includes(k) ? 1 : 0])),
  ...Object.fromEntries(h48.map((k) => [k, true])),
})

test('ranson: idade + leucócitos + cálcio baixo = 3, grave', () => {
  const res = ranson.calcular(r(['idade', 'leuco'], ['calcio']))!
  assert.equal(res.valor, '3')
  assert.equal(res.estado, 1)
  assert.match(res.nota, /pancreatite grave/)
  assert.equal(res.alerta, undefined)
})
test('ranson: cortes (2→0, 3→1, 4→1, 5→2) e máximo 11', () => {
  assert.equal(ranson.calcular(r(['idade'], ['ht']))!.estado, 0)
  assert.equal(ranson.calcular(r(['idade', 'ldh'], ['ht']))!.estado, 1)
  assert.equal(ranson.calcular(r(['idade', 'ldh'], ['ht', 'pao2']))!.estado, 1)
  assert.equal(ranson.calcular(r(['idade', 'ldh'], ['ht', 'pao2', 'bun']))!.estado, 2)
  assert.equal(ranson.calcular(r(ADM, ['ht', 'bun', 'calcio', 'pao2', 'deficit', 'sequestro']))!.valor, '11')
})
test('ranson: sem critério de 48 h avisa que o total é parcial', () => {
  const res = ranson.calcular(r(['idade', 'leuco', 'glicemia']))!
  assert.equal(res.valor, '3')
  assert.match(res.alerta!, /parcial/)
})
test('ranson: admissão incompleta devolve null', () => {
  const x = r([])
  delete x.ast
  assert.equal(ranson.calcular(x), null)
})
test('ranson: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(ranson.ficha.publico, 'adulto')
  assert.ok(ranson.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(ranson.ficha), false)
})
