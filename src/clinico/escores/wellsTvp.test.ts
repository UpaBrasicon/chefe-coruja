// node --experimental-strip-types --test src/clinico/escores/wellsTvp.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { wellsTvp } from './wellsTvp.ts'

const com = (...ids: string[]): Respostas => Object.fromEntries(wellsTvp.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))

test('wells tvp: câncer + edema de todo o membro + perimetria = 3, provável', () => {
  const r = wellsTvp.calcular(com('cancer', 'edemaTodo', 'perimetria'))!
  assert.equal(r.valor, '3')
  assert.equal(r.nota, 'TVP provável')
  assert.equal(r.estado, 2)
  assert.match(r.derivados[1][1], /^alta/)
})
test('wells tvp: diagnóstico alternativo subtrai 2 e pode dar negativo', () => {
  const r = wellsTvp.calcular(com('dor', 'alternativo'))!
  assert.equal(r.valor, '-1')
  assert.equal(r.unidade, 'ponto')
  assert.match(r.derivados[1][1], /^baixa/)
})
test('wells tvp: corte de duas bandas (1→improvável, 2→provável)', () => {
  assert.equal(wellsTvp.calcular(com('dor'))!.estado, 0)
  assert.equal(wellsTvp.calcular(com('dor', 'cacifo'))!.estado, 2)
})
test('wells tvp: cortes de três bandas (0→baixa, 1→moderada, 2→moderada, 3→alta)', () => {
  assert.match(wellsTvp.calcular(com())!.derivados[1][1], /^baixa/)
  assert.match(wellsTvp.calcular(com('dor'))!.derivados[1][1], /^moderada/)
  assert.match(wellsTvp.calcular(com('dor', 'cacifo'))!.derivados[1][1], /^moderada/)
  assert.match(wellsTvp.calcular(com('dor', 'cacifo', 'previa'))!.derivados[1][1], /^alta/)
})
test('wells tvp: alerta de recorrência só na banda improvável com TVP prévia', () => {
  assert.match(wellsTvp.calcular(com('previa'))!.alerta!, /recorrência/)
  assert.equal(wellsTvp.calcular(com('dor'))!.alerta, undefined)
})
test('wells tvp: incompleto devolve null', () => {
  const r = com()
  delete r.alternativo
  assert.equal(wellsTvp.calcular(r), null)
})
test('wells tvp: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(wellsTvp.ficha.publico, 'adulto')
  assert.ok(wellsTvp.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(wellsTvp.ficha), false)
})
