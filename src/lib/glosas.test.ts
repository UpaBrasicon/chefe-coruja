// node --experimental-strip-types --test src/lib/glosas.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acoesDaGlosa, lerValor } from './glosas.ts'

const fat = { pode_conduzir: true, pode_perder: false }
const gestor = { pode_conduzir: false, pode_perder: true }
const paras = (a: ReturnType<typeof acoesDaGlosa>) => a.map((x) => x.para)

test('faturamento conduz o recurso: aberta → em recurso → recuperada ou de volta a aberta', () => {
  assert.deepEqual(paras(acoesDaGlosa({ status: 'aberta' }, fat)), ['em_recurso'])
  assert.equal(acoesDaGlosa({ status: 'aberta' }, fat)[0].pedeCompetencia, true)
  assert.deepEqual(paras(acoesDaGlosa({ status: 'em_recurso' }, fat)), ['recuperada', 'aberta'])
  assert.deepEqual(paras(acoesDaGlosa({ status: 'recuperada' }, fat)), [])
})

test('só o gestor marca como perdida, e só em andamento', () => {
  assert.deepEqual(paras(acoesDaGlosa({ status: 'aberta' }, gestor)), ['perdida'])
  assert.deepEqual(paras(acoesDaGlosa({ status: 'em_recurso' }, gestor)), ['perdida'])
  assert.deepEqual(paras(acoesDaGlosa({ status: 'perdida' }, gestor)), [])
})

test('valor em reais', () => {
  assert.equal(lerValor('1.234,56'), 1234.56)
  assert.equal(lerValor('12,5'), 12.5)
  assert.equal(lerValor('10'), 10)
  assert.equal(lerValor(''), null)
  assert.equal(lerValor('-3'), null)
  assert.equal(lerValor('1,234'), null)
})
