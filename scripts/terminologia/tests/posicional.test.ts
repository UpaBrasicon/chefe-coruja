// ─────────────────────────────────────────────────────────────────────────────
// Testes do parser posicional (fixed-width) do SIGTAP/DATASUS
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parsearLayout, parsearLinhaPosicional, parsearArquivoPosicional } from '../lib/posicional.ts'

const LAYOUT = `Coluna,Tamanho,Inicio,Fim,Tipo
CO_PROCEDIMENTO,10,1,10,VARCHAR2
NO_PROCEDIMENTO,10,11,20,VARCHAR2
VL_SA,6,21,26,NUMBER
DT_COMPETENCIA,6,27,32,CHAR
`

describe('parsearLayout', () => {
  it('lê colunas do layout (ignora cabeçalho)', () => {
    const colunas = parsearLayout(LAYOUT)
    assert.equal(colunas.length, 4)
    assert.deepEqual(colunas[0], { nome: 'CO_PROCEDIMENTO', tamanho: 10, inicio: 1, fim: 10 })
    assert.equal(colunas[3].nome, 'DT_COMPETENCIA')
  })
})

describe('parsearLinhaPosicional', () => {
  it('corta linha pelas posições e faz trim', () => {
    const colunas = parsearLayout(LAYOUT)
    // CO_PROCEDIMENTO (1-10), NO_PROCEDIMENTO (11-20), VL_SA (21-26), DT_COMPETENCIA (27-32)
    const linha = '0101010010CONSULTA  000010202608'
    const obj = parsearLinhaPosicional(linha, colunas)
    assert.equal(obj.CO_PROCEDIMENTO, '0101010010')
    assert.equal(obj.NO_PROCEDIMENTO, 'CONSULTA')
    assert.equal(obj.VL_SA, '000010')
    assert.equal(obj.DT_COMPETENCIA, '202608')
  })

  it('suporta linhas mais curtas (campos faltantes vazios)', () => {
    const colunas = parsearLayout(LAYOUT)
    const obj = parsearLinhaPosicional('0101010010', colunas)
    assert.equal(obj.CO_PROCEDIMENTO, '0101010010')
    assert.equal(obj.NO_PROCEDIMENTO, '')
  })
})

describe('parsearArquivoPosicional', () => {
  it('parseia múltiplas linhas e ignora vazias', () => {
    const colunas = parsearLayout(LAYOUT)
    const linhas = parsearArquivoPosicional(
      '0101010010CONSULTA  000010202608\n0101010028EXAME     000020202608\n\n',
      colunas
    )
    assert.equal(linhas.length, 2)
    assert.equal(linhas[1].CO_PROCEDIMENTO, '0101010028')
  })
})
