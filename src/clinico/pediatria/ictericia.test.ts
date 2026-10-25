// node --experimental-strip-types --test src/clinico/pediatria/ictericia.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { faixaBilirrubina, fichaIctericiaNeonatal, limiaresIctericia, pedirSerica, suspensaoFototerapia } from './ictericia.ts'
import { FOTO_SEM_FATOR } from './ictericiaLimiares.ts'

test('icterícia: valores conferidos na imagem da Tabela Suplementar 1 (40 sem: 1 h = 8,9; 24 h = 13,3; 39 sem: 24 h = 12,8)', () => {
  assert.equal(FOTO_SEM_FATOR[40][1], 8.9)
  assert.equal(FOTO_SEM_FATOR[40][24], 13.3)
  assert.equal(FOTO_SEM_FATOR[39][24], 12.8)
  assert.equal(FOTO_SEM_FATOR[40][0], null)
})
test('icterícia: 40 semanas, 24 h, sem fator — fototerapia 13,3; depois de 96 h fica em 21,8 (nota da tabela)', () => {
  assert.equal(limiaresIctericia({ igSemanas: 40, horasDeVida: 24, fatorRisco: false })!.fototerapia, 13.3)
  assert.equal(limiaresIctericia({ igSemanas: 41, horasDeVida: 200, fatorRisco: false })!.fototerapia, 21.8)
})
test('icterícia: escalonamento = exsanguineotransfusão − 2 (KAS 17)', () => {
  const l = limiaresIctericia({ igSemanas: 38, horasDeVida: 120, fatorRisco: false })!
  assert.equal(l.exsanguineo, 27)
  assert.equal(l.escalonamento, 25)
  assert.equal(l.tabelaExs, 3)
})
test('icterícia: fator de risco usa as Tabelas 2 e 4; subindo na foto usa a Tabela 4', () => {
  assert.equal(limiaresIctericia({ igSemanas: 39, horasDeVida: 120, fatorRisco: true })!.fototerapia, 18.2)
  assert.equal(limiaresIctericia({ igSemanas: 39, horasDeVida: 30, fatorRisco: false, subindoNaFoto: true })!.tabelaExs, 4)
})
test('icterícia: fora da faixa (< 35 sem, hora 0, após 14 dias) não calcula', () => {
  assert.equal(limiaresIctericia({ igSemanas: 34, horasDeVida: 24, fatorRisco: false }), null)
  assert.equal(limiaresIctericia({ igSemanas: 37, horasDeVida: 0, fatorRisco: false }), null)
  assert.equal(limiaresIctericia({ igSemanas: 37, horasDeVida: 336, fatorRisco: false }), null)
})
test('icterícia: faixa da bilirrubina e regras KAS 6 e 15', () => {
  const l = { fototerapia: 15, exsanguineo: 25, escalonamento: 23, tabelaFoto: 1 as const, tabelaExs: 3 as const }
  assert.equal(faixaBilirrubina(14.9, l), 'abaixo')
  assert.equal(faixaBilirrubina(15, l), 'fototerapia')
  assert.equal(faixaBilirrubina(23, l), 'escalonamento')
  assert.equal(faixaBilirrubina(25, l), 'exsanguineo')
  assert.equal(pedirSerica(12, 15), true)
  assert.equal(pedirSerica(11.9, 15), false)
  assert.equal(pedirSerica(15, 20), true)
  assert.equal(suspensaoFototerapia(16.4), 14.4)
})
test('icterícia: ficha pediátrica com fonte pediátrica', () => {
  assert.equal(temReferenciaPediatrica(fichaIctericiaNeonatal), true)
})
