import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { ERRATA_WELLS_SIMPLIFICADO, PAC_ANTIBIOTICOS, atsIdsaPac, grupoPorPort, hestia, metilprednisolonaPac, perc, smartCop } from './tepPac.ts'

test('TEP/PAC: fichas de adulto', () => {
  for (const e of [perc, hestia, smartCop, atsIdsaPac]) {
    assert.equal(e.ficha.publico, 'adulto')
    assert.match(e.ficha.id, /^adulto-[a-z0-9-]+$/)
    assert.equal(temReferenciaPediatrica(e.ficha), false)
  }
})

const percNeg = { idade: 40, fc: 90, sat: 97, hemoptise: 0, edema: 0, cirurgia: 0, previo: 0, estrogenio: 0 }

test('PERC: todos negativos descarta; cortes 50 anos, FC 100, SaO2 95 (Tabela 4, p. 434)', () => {
  assert.equal(perc.calcular({ ...percNeg, sat: undefined }), null)
  assert.equal(perc.calcular(percNeg)!.valor, 'negativo')
  assert.equal(perc.calcular({ ...percNeg, idade: 50 })!.valor, 'positivo')
  assert.equal(perc.calcular({ ...percNeg, fc: 100 })!.valor, 'positivo')
  assert.equal(perc.calcular({ ...percNeg, sat: 95 })!.valor, 'negativo')
  assert.equal(perc.calcular({ ...percNeg, sat: 94 })!.valor, 'positivo')
  assert.match(ERRATA_WELLS_SIMPLIFICADO, /p\. 433/)
})

test('HESTIA: 11 perguntas; qualquer sim exclui (Tabela 11, p. 448)', () => {
  const nao = Object.fromEntries(hestia.itens.map((i) => [i.id, 0]))
  assert.equal(hestia.itens.length, 11)
  assert.equal(hestia.calcular(nao)!.estado, 0)
  assert.equal(hestia.calcular({ ...nao, clcr: 1 })!.valor, '1')
})

test('SMART-COP: pesos 2/1 e corte ≥ 3 (Tabela 6, p. 458)', () => {
  const zeros = { s: 0, m: 0, a: 0, r: 0, t: 0, c: 0, o: 0, p: 0 }
  assert.equal(smartCop.calcular({ ...zeros, s: 1, m: 1 })!.valor, '3')
  assert.equal(smartCop.calcular({ ...zeros, s: 1, m: 1 })!.estado, 2)
  assert.equal(smartCop.calcular({ ...zeros, s: 1 })!.estado, 1)
  assert.equal(smartCop.calcular({ s: 1, m: 1, a: 1, r: 1, t: 1, c: 1, o: 1, p: 1 })!.valor, '11')
})

test('ATS/IDSA: regra do livro (2 menores) × diretriz (3 menores) (p. 460)', () => {
  const dois = atsIdsaPac.calcular({ fr: true, ureia: true })!
  assert.equal(dois.estado, 1)
  assert.ok(dois.alerta)
  assert.equal(atsIdsaPac.calcular({ fr: true, ureia: true, plaq: true })!.estado, 2)
  assert.equal(atsIdsaPac.calcular({ vmi: true })!.estado, 2)
  assert.equal(atsIdsaPac.calcular({})!.estado, 0)
})

test('PAC: Tabela 10 e PORT (p. 457, 463)', () => {
  assert.deepEqual([grupoPorPort(2), grupoPorPort(3), grupoPorPort(5)], ['baixo', 'intermediario', 'alto'])
  assert.match(PAC_ANTIBIOTICOS.find((g) => g.grupo === 'alto')!.opcoes[0], /Ceftriaxona 1 g 12\/12 h/)
  assert.equal(PAC_ANTIBIOTICOS.find((g) => g.grupo === 'pseudomonas')!.opcoes.length, 4)
  assert.deepEqual(metilprednisolonaPac(80), { mgDose: 40, mgDia: 80 })
})
