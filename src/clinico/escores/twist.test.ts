// node --experimental-strip-types --test src/clinico/escores/twist.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Respostas } from '../escore.ts'
import { temReferenciaPediatrica } from '../ficha.ts'
import { twist, twistPed } from './twist.ts'

const com = (...ids: string[]): Respostas => Object.fromEntries(twist.itens.map((i) => [i.id, ids.includes(i.id)]))

test('TWIST: pontos do Barbosa 2013 (edema 2, endurecido 2, demais 1; máximo 7)', () => {
  assert.equal(twist.calcular(com())!.valor, '0')
  assert.equal(twist.calcular(com('edema'))!.valor, '2')
  assert.equal(twist.calcular(com('edema', 'endurecido', 'cremaster', 'nausea', 'elevado'))!.valor, '7')
})
test('TWIST: faixas 0–2, 3–4 e 5–7', () => {
  const baixo = twist.calcular(com('edema'))!
  assert.match(baixo.nota, /baixo risco/)
  assert.equal(baixo.estado, 0)
  const meio = twist.calcular(com('edema', 'nausea'))!
  assert.match(meio.nota, /intermediário/)
  assert.equal(meio.estado, 1)
  const meio4 = twist.calcular(com('edema', 'endurecido'))!
  assert.match(meio4.nota, /intermediário/)
  const alto = twist.calcular(com('edema', 'endurecido', 'cremaster'))!
  assert.match(alto.nota, /alto risco/)
  assert.equal(alto.estado, 2)
  assert.ok(alto.alerta)
})
test('TWIST: baixo risco avisa que não dispensa avaliação', () => {
  assert.ok(twist.calcular(com())!.cuidados.some((c) => /não dispensa/.test(c)))
})
test('TWIST: uma ficha para a criança e outra para o adulto, com a mesma regra', () => {
  assert.equal(twistPed.ficha.publico, 'pediatrico')
  assert.equal(twist.ficha.publico, 'adulto')
  assert.notEqual(twistPed.ficha.id, twist.ficha.id)
  assert.equal(temReferenciaPediatrica(twistPed.ficha), true)
  assert.equal(twistPed.calcular(com('edema', 'nausea'))!.valor, twist.calcular(com('edema', 'nausea'))!.valor)
  assert.match(twistPed.calcular(com())!.cuidados.at(-1)!, /14 anos ou mais usa a tela do adulto/)
})
