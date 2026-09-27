// node --experimental-strip-types --test src/clinico/escores/abcd2.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { abcd2 } from './abcd2.ts'

// Índice da opção = pontos em todos os itens.
const r = (idade: number, pa: number, clinica: number, duracao: number, dm: number): Respostas => ({ idade, pa, clinica, duracao, dm })

test('abcd2: ≥ 60 anos + PA ≥ 140/90 + fraqueza unilateral + 60 min = 6, alto risco', () => {
  const res = abcd2.calcular(r(1, 1, 2, 2, 0))!
  assert.equal(res.valor, '6')
  assert.equal(res.estado, 2)
  assert.deepEqual(res.derivados[1], ['AVC em 2 dias', '8,1%'])
  assert.deepEqual(res.derivados[2], ['AVC em 7 dias', '11,7%'])
})
test('abcd2: cortes das faixas (3→0, 4→1, 5→1, 6→2)', () => {
  assert.equal(abcd2.calcular(r(1, 1, 1, 0, 0))!.estado, 0)
  assert.equal(abcd2.calcular(r(1, 1, 1, 1, 0))!.estado, 1)
  assert.equal(abcd2.calcular(r(1, 1, 2, 1, 0))!.estado, 1)
  assert.equal(abcd2.calcular(r(1, 1, 2, 1, 1))!.estado, 2)
})
test('abcd2: escore baixo mantém o alerta das diretrizes', () => {
  assert.ok(abcd2.calcular(r(0, 0, 0, 0, 0))!.alerta)
})
test('abcd2: incompleto devolve null', () => {
  assert.equal(abcd2.calcular({ idade: 0, pa: 0, clinica: 0, duracao: 0 }), null)
})
test('abcd2: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(abcd2.ficha.publico, 'adulto')
  assert.ok(abcd2.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(abcd2.ficha), false)
})
