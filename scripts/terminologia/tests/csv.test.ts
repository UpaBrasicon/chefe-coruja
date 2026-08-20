// ─────────────────────────────────────────────────────────────────────────────
// Testes do parser CSV (unidade)
// Roda com: node --test scripts/terminologia/tests/
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { lerCsv, coluna, normalizarCabecalho } from '../lib/csv.ts'

describe('lerCsv', () => {
  it('parseia CSV com separador ; e aspas', () => {
    const csv = 'codigo;descricao;capitulo\nA00;Cólera;"I - Algumas doenças"\nA01;Febre tifoide;I'
    const linhas = lerCsv(csv)
    assert.equal(linhas.length, 2)
    assert.equal(linhas[0].codigo, 'A00')
    assert.equal(linhas[0].descricao, 'Cólera')
    assert.equal(linhas[0].capitulo, 'I - Algumas doenças')
    assert.equal(linhas[1].codigo, 'A01')
  })

  it('parseia CSV com separador , e aspas com escape duplo', () => {
    const csv = 'code,name\n"01","John ""J"" Doe"\n02,"Maria, Silva"'
    const linhas = lerCsv(csv)
    assert.equal(linhas.length, 2)
    assert.equal(linhas[0].name, 'John "J" Doe')
    assert.equal(linhas[1].name, 'Maria, Silva')
  })

  it('aceita CRLF e BOM UTF-8', () => {
    const csv = '\uFEFFcodigo;titulo\r\n1;Médico\r\n2;Enfermeiro\r\n'
    const linhas = lerCsv(csv)
    assert.equal(linhas.length, 2)
    assert.equal(linhas[1].titulo, 'Enfermeiro')
  })

  it('normaliza cabeçalhos (acentos, maiúsculas, espaços)', () => {
    const csv = 'Código;Princípio Ativo\nX;Y'
    const linhas = lerCsv(csv)
    assert.ok('codigo' in linhas[0])
    assert.ok('principioativo' in linhas[0])
    assert.equal(coluna(linhas[0], ['Princípio Ativo']), 'Y')
  })

  it('lança erro para CSV vazio', () => {
    assert.throws(() => lerCsv(''))
  })

  it('ignora linhas vazias no meio', () => {
    const csv = 'a;b\n1;2\n\n3;4\n'
    const linhas = lerCsv(csv)
    assert.equal(linhas.length, 2)
  })
})

describe('normalizarCabecalho', () => {
  it('remove acentos e símbolos', () => {
    assert.equal(normalizarCabecalho('Código-10'), 'codigo10')
    assert.equal(normalizarCabecalho('Nome (Completo)'), 'nomecompleto')
  })
})
