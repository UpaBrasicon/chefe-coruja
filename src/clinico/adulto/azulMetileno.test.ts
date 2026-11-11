// node --experimental-strip-types --test src/clinico/adulto/azulMetileno.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { AZUL_METILENO, azulMetileno, fichaIntoxicacoesAdulto } from './intoxicacoes.ts'

// Azul de metileno no adulto (pedido do RT, opção A, 11/11/2026): dose da AHA 2025/2023.
test('azul de metileno: 1–2 mg/kg e teto de 7 mg/kg (AHA 2025, Tabela 4)', () => {
  assert.deepEqual(AZUL_METILENO.mgKg, [1, 2])
  assert.equal(AZUL_METILENO.maxMgKg, 7)
  assert.deepEqual(azulMetileno(70), { doseMg: [70, 140], maxMg: 490 })
  assert.equal(azulMetileno(0), null)
})
test('azul de metileno: cuidados de G6PD, refratária, ácido ascórbico e N-acetilcisteína', () => {
  const c = AZUL_METILENO.cuidados.join(' ')
  assert.match(c, /G6PD/)
  assert.match(c, /exsanguineotransfusão/)
  assert.match(c, /Ácido ascórbico/)
  assert.match(c, /N-acetilcisteína não/)
  assert.match(AZUL_METILENO.volume, /bula/)
})
test('azul de metileno: ficha em versão nova e bloco na tela', () => {
  assert.equal(fichaIntoxicacoesAdulto.versao, '2026-11-11.3')
  const tela = readFileSync('src/pages/plantonista/manual/IntoxicacoesAntidotosAdulto.tsx', 'utf8')
  assert.match(tela, /<Metemoglobinemia peso=\{peso\} \/>/)
})
