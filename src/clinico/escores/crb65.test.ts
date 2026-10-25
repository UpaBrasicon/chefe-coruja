// node --experimental-strip-types --test src/clinico/escores/crb65.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { crb65 } from './crb65.ts'

const com = (...ids: string[]): Respostas => Object.fromEntries(crb65.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))
const observada = (r: ReturnType<typeof crb65.calcular>) => r!.derivados.slice(1).map((d) => d[1])

test('CRB-65: faixas de McNally 2010 (0 baixo, 1–2 intermediário, 3–4 alto)', () => {
  assert.equal(crb65.calcular(com())!.estado, 0)
  assert.equal(crb65.calcular(com('c'))!.estado, 1)
  assert.equal(crb65.calcular(com('c', 'r'))!.estado, 1)
  assert.equal(crb65.calcular(com('c', 'r', 'b'))!.estado, 2)
  assert.equal(crb65.calcular(com('c', 'r', 'b', 'i'))!.valor, '4')
})
test('CRB-65: mortalidade observada da Tabela 2, hospital e comunidade', () => {
  assert.deepEqual(observada(crb65.calcular(com())), ['2,4%', '0,0%'])
  assert.deepEqual(observada(crb65.calcular(com('i', 'b'))), ['13,3%', '1,6%'])
  assert.deepEqual(observada(crb65.calcular(com('c', 'r', 'b', 'i'))), ['34,3%', '18,5%'])
})
test('CRB-65: sem ureia, quatro itens', () => {
  assert.deepEqual(crb65.itens.map((i) => i.id), ['c', 'r', 'b', 'i'])
})
test('CRB-65: incompleto devolve null', () => {
  assert.equal(crb65.calcular({ c: 1 }), null)
})
test('CRB-65: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(crb65.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(crb65.ficha), false)
})
