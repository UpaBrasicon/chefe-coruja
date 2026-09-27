// node --experimental-strip-types --test src/clinico/escores/glasgowBlatchford.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { glasgowBlatchford } from './glasgowBlatchford.ts'

// sexo 0 masculino, 1 feminino; achados clínicos 0/1.
const r = (x: Respostas = {}): Respostas => ({
  sexo: 0, ureia: 30, hb: 14, pas: 120, fc: 80, melena: 0, sincope: 0, hepatica: 0, ic: 0, ...x,
})

test('blatchford: tudo normal = 0', () => {
  const res = glasgowBlatchford.calcular(r())!
  assert.equal(res.valor, '0')
  assert.equal(res.estado, 0)
})
test('blatchford: ureia 60,06 mg/dL (10 mmol/L) + Hb 11 homem + PAS 95 + FC 105 + melena = 4+3+2+1+1 = 11', () => {
  const res = glasgowBlatchford.calcular(r({ ureia: 60.06, hb: 11, pas: 95, fc: 105, melena: 1 }))!
  assert.equal(res.valor, '11')
  assert.equal(res.estado, 2)
  assert.match(res.derivados[1][1], /^10 mmol\/L/)
})
test('blatchford: faixas de ureia em mmol/L (6,5 / 8 / 10 / 25)', () => {
  const pU = (mgdl: number) => glasgowBlatchford.calcular(r({ ureia: mgdl }))!.derivados[2][1].split(' ')[0]
  assert.equal(pU(6.4 * 6.006), '0')
  assert.equal(pU(6.5 * 6.006), '2')
  assert.equal(pU(7.9 * 6.006), '2')
  assert.equal(pU(8 * 6.006), '3')
  assert.equal(pU(10 * 6.006), '4')
  assert.equal(pU(24.9 * 6.006), '4')
  assert.equal(pU(25 * 6.006), '6')
})
test('blatchford: hemoglobina por sexo, pressão e pulso', () => {
  const pH = (sexo: number, hb: number) => glasgowBlatchford.calcular(r({ sexo, hb }))!.derivados[3][1].split(' ')[0]
  assert.equal(pH(0, 13), '0')
  assert.equal(pH(0, 12.9), '1')
  assert.equal(pH(0, 11.9), '3')
  assert.equal(pH(0, 9.9), '6')
  assert.equal(pH(1, 12), '0')
  assert.equal(pH(1, 11.9), '1')
  assert.equal(pH(1, 9.9), '6')
  const pP = (pas: number) => glasgowBlatchford.calcular(r({ pas }))!.derivados[4][1].split(' ')[0]
  assert.equal(pP(110), '0')
  assert.equal(pP(109), '1')
  assert.equal(pP(99), '2')
  assert.equal(pP(89), '3')
  assert.equal(glasgowBlatchford.calcular(r({ fc: 99 }))!.valor, '0')
  assert.equal(glasgowBlatchford.calcular(r({ fc: 100 }))!.valor, '1')
})
test('blatchford: cortes das faixas (1→0, 2→1, 5→1, 6→2)', () => {
  assert.equal(glasgowBlatchford.calcular(r({ melena: 1 }))!.estado, 0)
  assert.equal(glasgowBlatchford.calcular(r({ sincope: 1 }))!.estado, 1)
  assert.equal(glasgowBlatchford.calcular(r({ sincope: 1, hepatica: 1, melena: 1 }))!.estado, 1)
  assert.equal(glasgowBlatchford.calcular(r({ sincope: 1, hepatica: 1, ic: 1 }))!.estado, 2)
})
test('blatchford: incompleto ou fora da faixa devolve null', () => {
  const x = r()
  delete x.ic
  assert.equal(glasgowBlatchford.calcular(x), null)
  assert.equal(glasgowBlatchford.calcular(r({ hb: 120 })), null)
})
test('blatchford: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(glasgowBlatchford.ficha.publico, 'adulto')
  assert.ok(glasgowBlatchford.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(glasgowBlatchford.ficha), false)
})
