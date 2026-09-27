// node --experimental-strip-types --test src/clinico/escores/canadianCtHead.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { canadianCtHead } from './canadianCtHead.ts'

/** Critérios presentes pelo id; os demais respondidos "Não". */
const com = (...ids: string[]): Respostas => Object.fromEntries(canadianCtHead.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))

test('canadian ct head: nenhum critério = regra negativa', () => {
  const r = canadianCtHead.calcular(com())!
  assert.equal(r.valor, 'Regra negativa')
  assert.equal(r.estado, 0)
})
test('canadian ct head: um critério de alto risco = regra positiva, alto risco', () => {
  const r = canadianCtHead.calcular(com('idade65'))!
  assert.equal(r.valor, 'Regra positiva')
  assert.equal(r.estado, 2)
  assert.match(r.nota, /^alto risco · 1 critério de alto risco/)
  assert.ok(r.alerta)
})
test('canadian ct head: só risco médio = regra positiva, risco médio', () => {
  const r = canadianCtHead.calcular(com('mecanismo'))!
  assert.equal(r.valor, 'Regra positiva')
  assert.equal(r.estado, 1)
  assert.match(r.nota, /^risco médio/)
  assert.equal(r.alerta, undefined)
})
test('canadian ct head: cada critério sozinho torna a regra positiva', () => {
  for (const i of canadianCtHead.itens) assert.equal(canadianCtHead.calcular(com(i.id))!.valor, 'Regra positiva', i.id)
})
test('canadian ct head: contagem nos derivados', () => {
  const r = canadianCtHead.calcular(com('glasgow', 'vomitos', 'amnesia'))!
  assert.deepEqual(r.derivados[0], ['Critérios de alto risco', '2 de 5'])
  assert.deepEqual(r.derivados[1], ['Critérios de risco médio', '1 de 2'])
})
test('canadian ct head: sem conduta no resultado', () => {
  const r = canadianCtHead.calcular(com('glasgow'))!
  const texto = [r.valor, r.nota, r.alerta, ...r.derivados.flat(), ...r.cuidados].join(' ')
  assert.doesNotMatch(texto, /indicada|pedir|solicitar|conduta/i)
})
test('canadian ct head: incompleto devolve null', () => {
  const r = com()
  delete r.mecanismo
  assert.equal(canadianCtHead.calcular(r), null)
  assert.equal(canadianCtHead.calcular({}), null)
})
test('canadian ct head: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(canadianCtHead.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(canadianCtHead.ficha), false)
})
