// node --experimental-strip-types --test src/clinico/pediatria/ituPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { AVISO_AAP_2026, DOSES_ITU_ORAL, DOSES_ITU_PARENTERAL, QUADRO3, fichaItuPed, lerUrocultura, testarUrinaAap } from './ituPed.ts'

const d = (id: string) => [...DOSES_ITU_ORAL, ...DOSES_ITU_PARENTERAL].find((x) => x.id === id)!

test('Tabela 2 (p. 592) lida como impressa', () => {
  assert.equal(temReferenciaPediatrica(fichaItuPed), true)
  assert.deepEqual(testarUrinaAap('menina', false, 1), { limiar1: false, limiar2: false })
  assert.deepEqual(testarUrinaAap('menina', false, 2), { limiar1: true, limiar2: false })
  assert.deepEqual(testarUrinaAap('menino', false, 0), { limiar1: true, limiar2: true })
  assert.deepEqual(testarUrinaAap('menino', true, 3), { limiar1: true, limiar2: false })
  assert.equal(testarUrinaAap('menino', true, -1), null)
})

test('urocultura por método de coleta (p. 594–595)', () => {
  assert.match(lerUrocultura('saco', 100_000, true)!, /não é aceito/)
  assert.match(lerUrocultura('sondagem', 60_000, true)!, /≥ 50\.000/)
  assert.match(lerUrocultura('jato', 60_000, true)!, /abaixo do limiar/)
  assert.match(lerUrocultura('jato', 100_000, true)!, /≥ 100\.000/)
  assert.match(lerUrocultura('psp', 5_000, true)!, /< 10\.000/)
  assert.match(lerUrocultura('sondagem', 80_000, false)!, /Mais de um germe/)
})

test('Tabelas 3 e 4 (p. 597–598) com máximos do Apêndice', () => {
  assert.deepEqual(calcularDoseLivro(d('cefalexina'), 10)!.porDose, [125, 500])
  assert.deepEqual(calcularDoseLivro(d('cefalexina'), 60)!.dia, [3000, 4000])
  assert.deepEqual(calcularDoseLivro(d('ceftriaxona'), 20)!.porDose, [700, 1400])
  assert.deepEqual(calcularDoseLivro(d('ceftriaxona'), 40)!.porDose, [1400, 2000])
  assert.deepEqual(calcularDoseLivro(d('gentamicina'), 10)!.porDose, [25, 75])
  assert.deepEqual(calcularDoseLivro(d('cipro-iv'), 40)!.dia, [800, 800])
  assert.equal(QUADRO3.length, 9)
})

test('AAP 2026 citada sem limiar novo (texto integral pendente)', () => {
  assert.ok(fichaItuPed.fontes.some((f) => f.citacao.includes('PMID 42803578')))
  assert.ok(fichaItuPed.versao >= '2026-10-09.1')
  assert.ok(!AVISO_AAP_2026.join(' ').match(/UFC|\d+\.\d{3}/))
})
