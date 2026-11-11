// node --experimental-strip-types --test src/clinico/pediatria/ten4Facesp.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Respostas } from '../escore.ts'
import { temReferenciaPediatrica } from '../ficha.ts'
import { ten4Facesp } from './ten4Facesp.ts'

const com = (...ids: string[]): Respostas => Object.fromEntries(ten4Facesp.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))

test('TEN-4-FACESp: sem resposta completa não calcula', () => {
  assert.equal(ten4Facesp.calcular({ aplica: 1 }), null)
})
test('TEN-4-FACESp: criança sem hematoma ou com 4 anos ou mais = não se aplica', () => {
  const r = ten4Facesp.calcular(com('ten'))!
  assert.equal(r.valor, 'Não se aplica')
  assert.equal(r.estado, 0)
})
test('TEN-4-FACESp: nenhum componente = regra negativa, que não exclui maus-tratos', () => {
  const r = ten4Facesp.calcular(com('aplica'))!
  assert.equal(r.valor, 'Regra negativa')
  assert.match(r.nota, /não exclui/)
  assert.equal(r.alerta, undefined)
})
test('TEN-4-FACESp: qualquer componente sozinho torna a regra positiva', () => {
  for (const id of ['ten', 'faces', 'quatro', 'padrao']) {
    const r = ten4Facesp.calcular(com('aplica', id))!
    assert.equal(r.valor, 'Regra positiva', id)
    assert.equal(r.estado, 2)
    assert.match(r.alerta!, /notificação/)
  }
})
test('TEN-4-FACESp: lista os componentes presentes', () => {
  const r = ten4Facesp.calcular(com('aplica', 'faces', 'padrao'))!
  assert.equal(r.derivados[0][1], 'FACES (face); p (hematoma com padrão)')
})
test('TEN-4-FACESp: ficha pediátrica com fonte pediátrica e sem dose', () => {
  assert.equal(ten4Facesp.ficha.publico, 'pediatrico')
  assert.equal(temReferenciaPediatrica(ten4Facesp.ficha), true)
})
