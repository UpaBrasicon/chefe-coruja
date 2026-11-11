// node --experimental-strip-types --test src/clinico/escores/light.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { light } from './light.ts'

/** Transudato: proteína 0,40, LDH 0,50, LDH pleural 100 contra 2/3 de 250 (166,67). */
const base: Respostas = { protP: 2.8, protS: 7, ldhP: 100, ldhS: 200, ldhLSN: 250 }

test('light: padrão do protótipo (3/7, 180/200, 180 > 166,67) = exsudato por 2 critérios', () => {
  const r = light.calcular({ protP: 3, protS: 7, ldhP: 180, ldhS: 200, ldhLSN: 250 })!
  assert.equal(r.valor, 'Exsudato')
  assert.equal(r.nota, '2 critérios positivos de 3')
  assert.equal(r.estado, 1)
  assert.equal(r.derivados[0][1], '0,43 · corte 0,50 · negativo')
  assert.equal(r.derivados[1][1], '0,9 · corte 0,60 · POSITIVO')
  assert.equal(r.derivados[2][1], '180 contra 166,67 U/L · POSITIVO')
})
test('light: nenhum critério = transudato', () => {
  const r = light.calcular(base)!
  assert.equal(r.valor, 'Transudato')
  assert.equal(r.estado, 0)
  assert.equal(r.alerta, undefined)
})
test('light: critério 1 no corte (0,50 não conta) e acima', () => {
  assert.equal(light.calcular({ ...base, protP: 3.5 })!.valor, 'Transudato')
  assert.equal(light.calcular({ ...base, protP: 3.6 })!.valor, 'Exsudato')
})
test('light: critério 2 no corte (0,60 não conta) e acima', () => {
  assert.equal(light.calcular({ ...base, ldhP: 120, ldhLSN: 1000 })!.valor, 'Transudato')
  assert.equal(light.calcular({ ...base, ldhP: 121, ldhLSN: 1000 })!.valor, 'Exsudato')
})
test('light: critério 3 no corte (2/3 do LSN não conta) e acima', () => {
  // LSN 150 → 2/3 = 100; LDH sérico alto para o critério 2 não interferir
  assert.equal(light.calcular({ ...base, ldhS: 1000, ldhLSN: 150 })!.valor, 'Transudato')
  const r = light.calcular({ ...base, ldhP: 101, ldhS: 1000, ldhLSN: 150 })!
  assert.equal(r.valor, 'Exsudato')
  assert.equal(r.nota, '1 critério positivo de 3')
  assert.match(r.alerta ?? '', /margem estreita/)
})
test('light: exsudato com gradiente de albumina acima de 1,2 alerta para falso exsudato', () => {
  const r = light.calcular({ ...base, protP: 3.6, albS: 3.5, albP: 2 })!
  assert.equal(r.derivados[3][1], '1,5 g/dL · corte 1,2')
  assert.match(r.alerta ?? '', /FALSO EXSUDATO/)
  const noCorte = light.calcular({ ...base, protP: 3.6, albS: 3.2, albP: 2 })!
  assert.doesNotMatch(noCorte.alerta ?? '', /FALSO EXSUDATO/)
})
test('light: albumina opcional — sem ela o gradiente fica em branco', () => {
  const r = light.calcular(base)!
  assert.equal(r.derivados[3][1], '— g/dL · corte 1,2')
})
test('light: incompleto devolve null', () => {
  assert.equal(light.calcular({ ...base, ldhLSN: undefined }), null)
  assert.equal(light.calcular({}), null)
})
test('light: número fora da faixa devolve null', () => {
  assert.equal(light.calcular({ ...base, protS: 0 }), null)
  assert.equal(light.calcular({ ...base, ldhP: -5 }), null)
  assert.equal(light.calcular({ ...base, albS: 50 }), null)
})
test('light: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(light.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(light.ficha), false)
})

// H21 (RT, 11/11/2026): sem soro, a tela recomenda a combinação tripla do
// Porcel 2026, e não mais a dupla (LDH ou colesterol), que perdeu exsudatos.
test('light: regra sem soro é a combinação tripla do Porcel 2026, com fonte', () => {
  const r = light.calcular(base)!
  const semSoro = r.cuidados?.find((c) => /Sem amostra sérica/.test(c)) ?? ''
  assert.match(semSoro, /proteína .*acima de 3 g\/dL/)
  assert.match(semSoro, /colesterol .*acima de 55 mg\/dL/)
  assert.match(semSoro, /Porcel 2026/)
  assert.match(semSoro, /dupla/)
  assert.doesNotMatch(semSoro, /capacidade discriminativa equivalente/)
  assert.match(r.derivados.find((d) => d[0] === 'Desempenho')![1], /Porcel 2026/)
  assert.ok(light.ficha.fontes.some((f) => /41846683/.test(f.citacao)))
  assert.equal(light.ficha.versao, '2026-11-11.1')
})
