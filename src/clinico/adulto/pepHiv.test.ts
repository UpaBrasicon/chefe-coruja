// node --experimental-strip-types --test src/clinico/adulto/pepHiv.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { esquemaPep, ighahbMl, indicacaoPep, type EntradaPep } from './pepHiv.ts'

const base: EntradaPep = { materialDeRisco: true, exposicaoDeRisco: true, horas: 10, exposta: 'nao_reagente', fonte: 'reagente' }

test('pep: quatro passos sim e fonte reagente = indicada (Quadro 1)', () => {
  assert.equal(indicacaoPep(base).status, 'indicada')
})
test('pep: material ou exposição sem risco = não indicada (Quadros 2 e 3)', () => {
  assert.equal(indicacaoPep({ ...base, materialDeRisco: false }).status, 'nao_indicada')
  assert.equal(indicacaoPep({ ...base, exposicaoDeRisco: false }).status, 'nao_indicada')
})
test('pep: limite de 72 horas (p. 6)', () => {
  assert.equal(indicacaoPep({ ...base, horas: 72 }).status, 'indicada')
  assert.equal(indicacaoPep({ ...base, horas: 73 }).status, 'nao_indicada')
})
test('pep: exposta reagente não recebe PEP; discordante é decisão conjunta (p. 6–7)', () => {
  assert.equal(indicacaoPep({ ...base, exposta: 'reagente' }).status, 'nao_indicada')
  assert.equal(indicacaoPep({ ...base, exposta: 'discordante' }).status, 'individualizar')
})
test('pep: fonte não reagente não indica, salvo janela de 30 dias; desconhecida individualiza (p. 7)', () => {
  assert.equal(indicacaoPep({ ...base, fonte: 'nao_reagente' }).status, 'nao_indicada')
  assert.equal(indicacaoPep({ ...base, fonte: 'nao_reagente', fonteJanela: true }).status, 'individualizar')
  assert.equal(indicacaoPep({ ...base, fonte: 'desconhecida' }).status, 'individualizar')
})
test('pep: esquema preferencial TDF/3TC + DTG 1 vez ao dia (Quadros 4–5)', () => {
  const e = esquemaPep({})
  assert.equal(e.nome, 'Preferencial')
  assert.match(e.remedios[0].droga, /TDF\/3TC/)
  assert.match(e.remedios[1].posologia, /1 vez ao dia/)
})
test('pep: indutor dobra o dolutegravir para 12/12 h (p. 12)', () => {
  assert.match(esquemaPep({ indutor: true }).remedios[1].posologia, /12\/12/)
})
test('pep: sem tenofovir = AZT/3TC 2x/dia; sem dolutegravir = DRV 800/RTV 1x/dia; gestante DRV 600/RTV 2x/dia', () => {
  assert.match(esquemaPep({ semTenofovir: true }).remedios[0].posologia, /2 vezes ao dia/)
  assert.match(esquemaPep({ semDolutegravir: true }).remedios[1].droga, /Darunavir 800/)
  assert.match(esquemaPep({ semDolutegravir: true, gestante: true }).remedios[1].droga, /Darunavir 600/)
})
test('pep: TFG abaixo de 50 avisa sobre o tenofovir (p. 12)', () => {
  assert.ok(esquemaPep({ tfg: 40 }).avisos.some((a) => a.includes('TFG')))
  assert.ok(!esquemaPep({ tfg: 60 }).avisos.some((a) => a.includes('TFG')))
})
test('pep: IGHAHB 0,06 mL/kg com teto de 5 mL (p. 29)', () => {
  assert.deepEqual(ighahbMl(50), { ml: 3, noTeto: false })
  assert.deepEqual(ighahbMl(100), { ml: 5, noTeto: true })
})
