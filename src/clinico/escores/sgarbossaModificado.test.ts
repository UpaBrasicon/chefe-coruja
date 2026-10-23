// node --experimental-strip-types --test src/clinico/escores/sgarbossaModificado.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { discordanteExcessivo, razaoStS, sgarbossaModificado } from './sgarbossaModificado.ts'

// ritmo: 0 BRE, 1 marca-passo; demais escolhas: 0 Não, 1 Sim
const r = (supraConcordante: number, infraV1V3: number, supraDiscordante: number, supraMm?: number, sMm?: number, ritmo = 0) =>
  ({ ritmo, supraConcordante, infraV1V3, supraDiscordante, supraMm, sMm })

test('sgarbossa: ST/S com sinal e corte em −0,25 com supra de 1 mm ou mais (Smith 2012, Meyers 2015)', () => {
  assert.equal(razaoStS(3, 12), -0.25)
  assert.equal(discordanteExcessivo(3, 12), true)
  assert.equal(discordanteExcessivo(2.5, 12), false)
  assert.equal(discordanteExcessivo(0.5, 1), false, 'supra abaixo de 1 mm não conta, mesmo com razão alta')
  assert.equal(razaoStS(2, 0), null)
})
test('sgarbossa: nenhum critério = negativo', () => {
  const res = sgarbossaModificado.calcular(r(0, 0, 0))!
  assert.equal(res.valor, 'Negativo')
  assert.equal(res.estado, 0)
})
test('sgarbossa: um critério basta (regra não ponderada)', () => {
  assert.equal(sgarbossaModificado.calcular(r(1, 0, 0))!.valor, 'Positivo')
  assert.equal(sgarbossaModificado.calcular(r(0, 1, 0))!.valor, 'Positivo')
  const res = sgarbossaModificado.calcular(r(0, 0, 1, 4, 10))!
  assert.equal(res.valor, 'Positivo')
  assert.deepEqual(res.derivados.find(([k]) => k === 'Razão ST/S'), ['Razão ST/S', '−0,40'])
})
test('sgarbossa: discordante proporcionalmente pequeno não pontua', () => {
  assert.equal(sgarbossaModificado.calcular(r(0, 0, 1, 2, 20))!.valor, 'Negativo')
})
test('sgarbossa: discordante marcado sem as medidas fica sem resultado', () => {
  assert.equal(sgarbossaModificado.calcular(r(0, 0, 1)), null)
})
test('sgarbossa: no marca-passo mostra o desempenho de Dodd 2021', () => {
  const res = sgarbossaModificado.calcular(r(0, 0, 0, undefined, undefined, 1))!
  assert.match(res.derivados.map(([k]) => k).join(' '), /marca-passo/)
})
