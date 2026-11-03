import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { dataIso } from './formato.ts'

// Lote "Virada de data" (BACKLOG.md, RT em 01/11/2026). O dia de hoje na tela é
// o de Brasília: das 21h às 24h a data UTC já é amanhã (no dia 31, o mês
// seguinte; em 31/12, o ano seguinte).

test('dataIso: 31/12 às 23h30 em Brasília ainda é 31/12', () => {
  const instante = new Date('2026-12-31T23:30:00-03:00')
  assert.equal(instante.toISOString().slice(0, 10), '2027-01-01')
  assert.equal(dataIso(instante), '2026-12-31')
})

// VD7: a validade da APAC começava pela data UTC e perdia a competência atual
test('APAC: o início da validade vem com o dia de Brasília', () => {
  const tela = readFileSync('src/pages/regulacao/Apac.tsx', 'utf8')
  const autorizar = tela.slice(tela.indexOf('function Autorizar('))
  assert.match(autorizar.slice(0, 400), /const \[ini, setIni\] = React\.useState\(dataIso\(\)\)/)
  assert.doesNotMatch(tela, /toISOString\(\)\.slice\(0, 10\)/)
})
