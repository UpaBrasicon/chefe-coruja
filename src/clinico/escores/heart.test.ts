// node --experimental-strip-types --test src/clinico/escores/heart.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { heart } from './heart.ts'

// Índice da opção = pontos (0, 1, 2) em todos os componentes.
const r = (historia: number, ecg: number, idade: number, fatores: number, trop: number): Respostas => ({ historia, ecg, idade, fatores, trop })

test('heart: história moderada, ECG normal, 45–64 anos, 1–2 fatores, troponina normal = 3, baixo risco', () => {
  const res = heart.calcular(r(1, 0, 1, 1, 0))!
  assert.equal(res.valor, '3')
  assert.equal(res.estado, 0)
  assert.match(res.nota, /1,7%/)
})
test('heart: cortes das faixas (3→0, 4→1, 6→1, 7→2)', () => {
  assert.equal(heart.calcular(r(1, 1, 1, 0, 0))!.estado, 0)
  assert.equal(heart.calcular(r(1, 1, 1, 1, 0))!.estado, 1)
  assert.equal(heart.calcular(r(2, 1, 1, 1, 1))!.estado, 1)
  const alto = heart.calcular(r(2, 2, 1, 1, 1))!
  assert.equal(alto.estado, 2)
  assert.match(alto.nota, /50,1%/)
})
test('heart: incompleto devolve null', () => {
  assert.equal(heart.calcular({ historia: 0, ecg: 0, idade: 0, fatores: 0 }), null)
})
test('heart: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(heart.ficha.publico, 'adulto')
  assert.ok(heart.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(heart.ficha), false)
})

test('heart: SBC 2025 ao lado do manual (cap. 12, lote 6 do HCFMUSP)', async () => {
  const h = await import('./heart.ts')
  assert.equal(h.heart.ficha.versao, '2026-11-14.1')
  assert.ok(h.heart.ficha.fontes.includes(h.SBC_DOR_TORACICA_2025))
  assert.match(h.SBC_DOR_TORACICA_2025.citacao, /PMID 41379176/)
  assert.equal(new Set(h.DIRETRIZ_DOR_TORACICA_2025.map((d) => d.tema)).size, h.DIRETRIZ_DOR_TORACICA_2025.length)
  assert.ok(h.DIRETRIZ_DOR_TORACICA_2025.some((d) => d.tema === 'Escore de risco' && d.grau === 'I, B'))
})
