// node --experimental-strip-types --test src/clinico/escores/civdIsth.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { civdIsth } from './civdIsth.ts'

/** Com doença de base (índice 0), predomínio "nenhum" (índice 2) e os índices dos parâmetros. */
const com = (plaq: number, dd: number, tp: number, fib: number, extra: Respostas = {}) =>
  civdIsth.calcular({ base: 0, fenotipo: 2, plaq, dd, tp, fib, ...extra })!

test('civd isth: plaquetas < 50 mil + D-dímero acentuado = 5, manifesta', () => {
  const r = com(2, 2, 0, 0)
  assert.equal(r.valor, '5')
  assert.equal(r.estado, 2)
  assert.equal(r.nota, 'compatível com CIVD manifesta')
})
test('civd isth: corte 5 (manifesta) e 4 (não manifesta)', () => {
  assert.equal(com(1, 1, 1, 0).valor, '4')
  assert.equal(com(1, 1, 1, 0).estado, 1)
  assert.deepEqual(com(1, 1, 1, 0).derivados[1], ['Leitura', 'CIVD não manifesta'])
  assert.equal(com(1, 1, 1, 1).valor, '5')
  assert.deepEqual(com(1, 1, 1, 1).derivados[1], ['Leitura', 'CIVD manifesta'])
})
test('civd isth: cor intermediária a partir de 3', () => {
  assert.equal(com(1, 0, 1, 0).estado, 0) // 2
  assert.equal(com(1, 0, 1, 1).estado, 1) // 3
})
test('civd isth: pontos do D-dímero (0, 2, 3) e máximo 8', () => {
  assert.equal(com(0, 1, 0, 0).valor, '2')
  assert.equal(com(2, 2, 2, 1).valor, '8')
})
test('civd isth: sem doença de base não se aplica', () => {
  const r = com(2, 2, 2, 1, { base: 1 })
  assert.equal(r.valor, 'Não se aplica')
  assert.equal(r.estado, 2)
  assert.ok(r.alerta)
})
test('civd isth: predomínio hemorrágico abaixo do corte, com 3 ou mais, tem alerta', () => {
  assert.ok(com(1, 0, 1, 1, { fenotipo: 0 }).alerta)
  assert.equal(com(1, 0, 1, 1).alerta, undefined)
  assert.equal(com(1, 0, 1, 0, { fenotipo: 0 }).alerta, undefined)
})
test('civd isth: sem conduta no resultado', () => {
  const r = com(2, 2, 2, 1)
  const texto = [r.nota, r.alerta, ...r.derivados.flat(), ...r.cuidados].join(' ')
  assert.doesNotMatch(texto, /transfund|heparina|antifibrinol|repetir/i)
})
test('civd isth: incompleto devolve null', () => {
  assert.equal(civdIsth.calcular({ base: 0, fenotipo: 2, plaq: 0, dd: 0, tp: 0 }), null)
  assert.equal(civdIsth.calcular({ fenotipo: 2, plaq: 0, dd: 0, tp: 0, fib: 0 }), null)
})
test('civd isth: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(civdIsth.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(civdIsth.ficha), false)
})
