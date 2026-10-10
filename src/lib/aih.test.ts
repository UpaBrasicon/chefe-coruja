// node --experimental-strip-types --test src/lib/aih.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { competenciaDaData, competenciaForaDoPrazo, competenciaNaTela, lerCompetencia, numeroAih, numeroAihValido, somarMeses } from './aih.ts'

test('número da AIH: 13 dígitos, aceitando separadores', () => {
  assert.equal(numeroAih('3526.100.012.345'), '3526100012345')
  assert.equal(numeroAihValido('3526100012345'), true)
  assert.equal(numeroAihValido('3526-1000-1234-5'), true)
  assert.equal(numeroAihValido('352610001234'), false)
  assert.equal(numeroAihValido('35261000123456'), false)
  assert.equal(numeroAihValido(''), false)
})

test('competência: MM/AAAA ou AAAAMM', () => {
  assert.equal(lerCompetencia('10/2026'), '202610')
  assert.equal(lerCompetencia('1/2027'), '202701')
  assert.equal(lerCompetencia('202612'), '202612')
  assert.equal(lerCompetencia('13/2026'), null)
  assert.equal(lerCompetencia('202600'), null)
  assert.equal(lerCompetencia('2026-10'), null)
  assert.equal(competenciaNaTela('202610'), '10/2026')
  assert.equal(competenciaNaTela(null), '—')
})

test('competência até 3 meses da alta', () => {
  assert.equal(somarMeses('202611', 3), '202702')
  assert.equal(somarMeses('202601', -1), '202512')
  assert.equal(competenciaForaDoPrazo('202702', '202611'), false)
  assert.equal(competenciaForaDoPrazo('202703', '202611'), true)
  assert.equal(competenciaForaDoPrazo('202703', null), false)
})

test('competência de uma data em Brasília', () => {
  assert.equal(competenciaDaData('2026-11-01T01:00:00Z'), '202610')
  assert.equal(competenciaDaData('2026-11-01T12:00:00Z'), '202611')
  assert.equal(competenciaDaData(null), null)
})
