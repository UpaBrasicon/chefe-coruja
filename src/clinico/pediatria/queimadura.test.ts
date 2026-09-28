import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ERRATA_LUND_BROWDER, colunaPorIdade, diureseAlvo, fichaQueimaduraPed, manutencao24hMl, parkland, somaManutencao, superficieQueimada, totalCorpo,
} from './queimadura.ts'

test('queimadura: ficha do ICr (cap. 14)', () => {
  assert.equal(temReferenciaPediatrica(fichaQueimaduraPed), true)
  assert.match(fichaQueimaduraPed.fontes[0].citacao, /cap\. 14, p\. 158–164/)
})

test('Lund e Browder: colunas 0, 1 e 5 anos somam 100%; 10 anos soma 101% (errata registrada)', () => {
  assert.equal(totalCorpo(0), 100)
  assert.equal(totalCorpo(1), 100)
  assert.equal(totalCorpo(5), 100)
  assert.equal(totalCorpo(10), 101)
  assert.equal(ERRATA_LUND_BROWDER.length, 3)
})

test('coluna pela idade: maior idade da tabela que não passa da idade; ≥ 14 anos fora', () => {
  assert.equal(colunaPorIdade(0.5), 0)
  assert.equal(colunaPorIdade(1), 1)
  assert.equal(colunaPorIdade(4.9), 1)
  assert.equal(colunaPorIdade(7), 5)
  assert.equal(colunaPorIdade(13.9), 10)
  assert.equal(colunaPorIdade(14), null)
})

test('SCQ: soma das regiões × fração (Figura 1, p. 160)', () => {
  // lactente de 6 meses: cabeça anterior inteira (9,5) + tronco anterior metade (6,5) + mão direita anterior (1,25)
  assert.equal(superficieQueimada(0, { 'cabeca-ant': 1, 'tronco-ant': 0.5, 'mao-d-ant': 1 }), 17.25)
  // criança de 6 anos: coxas anteriores inteiras (B = 4 cada)
  assert.equal(superficieQueimada(5, { 'coxa-d-ant': 1, 'coxa-e-ant': 1 }), 8)
  assert.equal(superficieQueimada(5, { inexistente: 1 }), null)
  assert.equal(superficieQueimada(5, { 'coxa-d-ant': 1.5 }), null)
})

test('Parkland: 3 mL/kg/%SCQ, teto de 50%, metade em 8 h a contar do acidente (p. 161–162)', () => {
  const p = parkland(20, 30)!
  assert.equal(p.totalMl, 1800)
  assert.equal(p.primeiras8hMl, 900)
  assert.equal(p.mlHAte8h, 112.5)
  assert.equal(p.mlH16h, 56.25)
  const t = parkland(20, 70)!
  assert.equal(t.scqUsada, 50)
  assert.equal(t.totalMl, 3000)
  const atrasado = parkland(20, 30, 2)! // 900 mL nas 6 h restantes
  assert.equal(atrasado.mlHAte8h, 150)
  assert.equal(parkland(20, 30, 9)!.mlHAte8h, null)
  assert.equal(parkland(0, 30), null)
})

test('manutenção somada em < 5 anos ou < 30 kg; diurese-alvo (p. 161–162)', () => {
  assert.equal(somaManutencao(3, 14), true)
  assert.equal(somaManutencao(8, 25), true)
  assert.equal(somaManutencao(8, 30), false)
  assert.equal(manutencao24hMl(14), 1200)
  assert.deepEqual(diureseAlvo(20), { mlKgH: [1, 2], mlH: [20, 40] })
  assert.deepEqual(diureseAlvo(30)!.mlKgH, [1, 2])
  assert.deepEqual(diureseAlvo(40)!.mlKgH, [0.5, 1])
  assert.deepEqual(diureseAlvo(40, true)!.mlKgH, [1, 2])
})
