// node --experimental-strip-types --test src/clinico/escores/meld3.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { meld3 } from './meld3.ts'

// sexo: 0 masculino, 1 feminino; dialise: 0 não, 1 sim.
const f = (bili: number, inr: number, cr: number, na: number, alb: number, sexo = 0, dialise = 0) =>
  meld3.calcular({ bili, inr, cr, na, alb, sexo, dialise })

test('meld 3.0: caso calculado à mão (bili 2, INR 1,5, Cr 1,2, Na 135, Alb 3, masculino)', () => {
  // ln2 = 0,6931, ln1,5 = 0,4055, ln1,2 = 0,1823; dNa = 2; dAlb = 0,5
  // 4,56·0,6931 + 0,82·2 − 0,24·2·0,6931 + 9,09·0,4055 + 11,14·0,1823
  //   + 1,85·0,5 − 1,83·0,5·0,1823 + 6 = 16,94 → 17
  // MELD = 3,78·0,6931 + 11,2·0,4055 + 9,57·0,1823 + 6,43 = 15,34 → 15
  // MELD-Na = 15 + 1,32·2 − 0,033·15·2 = 16,65 → 17
  const r = f(2, 1.5, 1.2, 135, 3)!
  assert.equal(r.valor, '17')
  assert.equal(r.estado, 0)
  assert.deepEqual(r.derivados[1], ['MELD-Na · versão anterior', '17 pontos'])
  assert.deepEqual(r.derivados[2], ['MELD original · 2001', '15 pontos'])
  assert.equal(r.alerta, undefined)
})
test('meld 3.0: sexo feminino soma 1,33 (16,94 + 1,33 → 18) e alerta a diferença com o MELD-Na', () => {
  const r = f(2, 1.5, 1.2, 135, 3, 1)!
  assert.equal(r.valor, '18')
  assert.match(r.alerta!, /1 ponto a MAIS/)
})
test('meld 3.0: cortes das faixas (19→0, 20→1, 29→1, 30→2)', () => {
  assert.equal(f(2, 1.5, 1.5, 135, 3)!.valor, '19')
  assert.equal(f(2, 1.5, 1.5, 135, 3)!.estado, 0)
  assert.equal(f(2.5, 1.5, 1.5, 135, 3)!.valor, '20')
  assert.equal(f(2.5, 1.5, 1.5, 135, 3)!.estado, 1)
  assert.equal(f(8, 2, 1.5, 130, 2.8)!.valor, '29')
  assert.equal(f(8, 2, 1.5, 130, 2.8)!.estado, 1)
  assert.equal(f(10, 2, 1.5, 130, 2.8)!.valor, '30')
  assert.equal(f(10, 2, 1.5, 130, 2.8)!.estado, 2)
})
test('meld 3.0: pisos, tetos e diálise', () => {
  assert.equal(f(0.5, 0.8, 0.6, 140, 4)!.valor, '6')
  assert.equal(f(40, 8, 10, 115, 1)!.valor, '40')
  assert.deepEqual(f(2, 1.5, 5, 135, 3)!.derivados[5], ['Creatinina no MELD 3.0', '3 mg/dL (teto de 3,0)'])
  assert.deepEqual(f(2, 1.5, 1.2, 135, 3, 0, 1)!.derivados[5], ['Creatinina no MELD 3.0', '3 mg/dL (diálise força 3,0)'])
  assert.deepEqual(f(2, 1.5, 1.2, 120, 3)!.derivados[7], ['Sódio na conta', '125 mEq/L (limitado pela fórmula)'])
})
test('meld 3.0: incompleto ou fora da faixa de digitação devolve null', () => {
  assert.equal(meld3.calcular({ bili: 2, inr: 1.5, cr: 1.2, na: 135, sexo: 0, dialise: 0 }), null)
  assert.equal(meld3.calcular({}), null)
  assert.equal(f(2, 1.5, 1.2, 1350, 3), null)
  assert.equal(f(-1, 1.5, 1.2, 135, 3), null)
})
test('meld 3.0: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(meld3.ficha.publico, 'adulto')
  assert.ok(meld3.ficha.fontes.every((x) => !x.pediatrica))
  assert.equal(temReferenciaPediatrica(meld3.ficha), false)
})
