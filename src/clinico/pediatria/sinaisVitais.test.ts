// node --experimental-strip-types --test src/clinico/pediatria/sinaisVitais.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { DIAS_ANO, DIAS_MES } from './fonteP2.ts'
import { ANORMAIS_CHOQUE, FC_NORMAL, fichaSinaisVitais, pasFormula, referenciasPorIdade } from './sinaisVitais.ts'

test('sinais vitais: ficha pediátrica; faixas contíguas', () => {
  assert.equal(fichaSinaisVitais.publico, 'pediatrico')
  for (const t of [FC_NORMAL, ANORMAIS_CHOQUE]) {
    for (let i = 1; i < t.length; i++) assert.equal(t[i].de, t[i - 1].ate, t[i].rotulo)
  }
})

test('Quadro 1 do cap. 2 (p. 40)', () => {
  assert.deepEqual(referenciasPorIdade(3)!.fc!.valor.acordado, [100, 180])
  assert.deepEqual(referenciasPorIdade(30)!.fc!.valor.acordado, [100, 220])
  assert.deepEqual(referenciasPorIdade(1 * DIAS_ANO)!.fc!.valor.sono, [70, 120])
  assert.deepEqual(referenciasPorIdade(5 * DIAS_ANO)!.fc!.valor.acordado, [70, 110])
  assert.deepEqual(referenciasPorIdade(12 * DIAS_ANO)!.fc!.valor.acordado, [55, 90])
})

test('Tabela 1 do cap. 5 (p. 87), com a fórmula da PAS de 1 a 10 anos', () => {
  const rn = referenciasPorIdade(10)!.anormal!
  assert.equal(rn.valor.fcAcima, 205)
  assert.equal(rn.pas, 60)
  assert.equal(referenciasPorIdade(2 * DIAS_MES)!.anormal!.pas, 70)
  const tres = referenciasPorIdade(3 * DIAS_ANO + 30)!.anormal!
  assert.equal(tres.valor.fcAcima, 140)
  assert.equal(tres.valor.frAcima, 40)
  assert.equal(tres.pas, pasFormula(3))
  assert.equal(tres.pas, 76)
  assert.equal(referenciasPorIdade(5 * DIAS_ANO)!.anormal!.valor.frAcima, 34)
  assert.equal(referenciasPorIdade(8 * DIAS_ANO)!.anormal!.valor.frAcima, 20)
  const onze = referenciasPorIdade(11 * DIAS_ANO)!.anormal!
  assert.equal(onze.valor.fcAcima, 100)
  assert.equal(onze.pas, 90)
  assert.equal(referenciasPorIdade(13 * DIAS_ANO + 5)!.anormal!.valor.frAcima, 16)
})

test('PAS baixa na anafilaxia (p. 98) e FR normal na asma (p. 114)', () => {
  assert.equal(referenciasPorIdade(10)!.pasAnafilaxia, undefined) // o quadro começa em 1 mês
  assert.equal(referenciasPorIdade(6 * DIAS_MES)!.pasAnafilaxia!.pas, 70)
  assert.equal(referenciasPorIdade(10 * DIAS_ANO + 100)!.pasAnafilaxia!.pas, 90) // 70 + 2 × 10
  assert.equal(referenciasPorIdade(12 * DIAS_ANO)!.pasAnafilaxia!.pas, 90)
  assert.equal(referenciasPorIdade(30)!.frAsma!.valor, '< 60 ciclos/min')
  assert.equal(referenciasPorIdade(4 * DIAS_MES)!.frAsma!.valor, '< 50 ciclos/min')
  assert.equal(referenciasPorIdade(8 * DIAS_ANO + 100)!.frAsma!.valor, '< 30 ciclos/min')
})

test('fora da pediatria (14 anos) não devolve referência', () => {
  assert.equal(referenciasPorIdade(14 * DIAS_ANO), null)
  assert.equal(referenciasPorIdade(-1), null)
})
