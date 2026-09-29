// node --experimental-strip-types --test src/clinico/escores/years.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { grace } from './grace.ts'
import { light } from './light.ts'
import { years } from './years.ts'

// YEARS pelo resumo de van der Hulle 2017; Light e GRACE .1 de 28/09/2026.

test('years: nenhum item → limiar 1000; um item ou mais → 500', () => {
  assert.match(years.calcular({ tvp: 0, hemoptise: 0, provavel: 0 })!.nota, /1\.000 ng\/mL/)
  assert.match(years.calcular({ tvp: 0, hemoptise: 1, provavel: 0 })!.nota, /500 ng\/mL/)
  assert.equal(years.calcular({ tvp: 1, hemoptise: 1, provavel: 1 })!.valor, '3')
})

test('years: D-dímero abaixo do limiar é a leitura de TEP excluído do estudo; no limiar não', () => {
  const sem = years.calcular({ tvp: 0, hemoptise: 0, provavel: 0, ddimero: 999 })!
  assert.match(sem.derivados[3][1], /considerou o TEP excluído/)
  assert.equal(sem.estado, 0)
  const no = years.calcular({ tvp: 0, hemoptise: 0, provavel: 0, ddimero: 1000 })!
  assert.match(no.derivados[3][1], /não considerou/)
  assert.match(years.calcular({ tvp: 0, hemoptise: 0, provavel: 1, ddimero: 700 })!.derivados[3][1], /não considerou/)
})

test('years: o terceiro item é TEP mais provável, não neoplasia; sem referência pediátrica', () => {
  assert.ok(years.itens.some((i) => i.id === 'provavel' && /mais provável/.test(i.rotulo)))
  assert.ok(!years.itens.some((i) => /neoplasia/i.test(i.rotulo)))
  assert.equal(temReferenciaPediatrica(years.ficha), false)
  assert.equal(years.calcular({ tvp: 0, hemoptise: 0 }), null)
})

test('light .1: NT-proBNP em pg/mL com Porcel 2018 e o BANCA 2025 como nota', () => {
  assert.equal(light.ficha.versao, '2026-09-28.1')
  const r = light.calcular({ protP: 3, protS: 7, ldhP: 180, ldhS: 200, ldhLSN: 250 })!
  assert.ok(r.cuidados.some((c) => /1500 pg\/mL/.test(c)))
  assert.ok(r.cuidados.some((c) => /2500 pg\/mL/.test(c)))
  assert.ok(light.ficha.fontes.some((f) => /Porcel JM\. Biomarkers/.test(f.citacao)))
})

test('grace .1: faixas avisadas como da SCA sem supra', () => {
  assert.equal(grace.ficha.versao, '2026-09-28.1')
  const r = grace.calcular({ idade: 65, fc: 80, pas: 130, cr: 1, killip: 0, parada: 0, st: 0, marcador: 0 })!
  assert.ok(r.cuidados.some((c) => /SEM supra de ST/.test(c)))
})
