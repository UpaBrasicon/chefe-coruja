// ─────────────────────────────────────────────────────────────────────────────
// Testes da montagem CID-10 a partir dos arquivos do DATASUS
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatarCodigoCid, montarCid10, type LinhaDatasus } from '../lib/cid10.ts'

const capitulos: LinhaDatasus[] = [
  { NUMCAP: '1', CATINIC: 'A00', CATFIM: 'B99', DESCRICAO: 'Capítulo I - Algumas doenças infecciosas e parasitárias' },
  { NUMCAP: '2', CATINIC: 'C00', CATFIM: 'D48', DESCRICAO: 'Capítulo II - Neoplasias [tumores]' },
]

const grupos: LinhaDatasus[] = [
  { CATINIC: 'A00', CATFIM: 'A09', DESCRICAO: 'Doenças infecciosas intestinais' },
  { CATINIC: 'C00', CATFIM: 'C14', DESCRICAO: 'Neoplasias malignas de lábio, cavidade oral e faringe' },
]

const categorias: LinhaDatasus[] = [
  { CAT: 'A00', CLASSIF: '', DESCRICAO: 'Cólera', DESCRABREV: 'A00   Colera' },
  { CAT: 'C00', CLASSIF: '', DESCRICAO: 'Neoplasia maligna do lábio', DESCRABREV: 'C00   Neopl malig lábio' },
]

const subcategorias: LinhaDatasus[] = [
  { SUBCAT: 'A000', CLASSIF: '', DESCRICAO: 'Cólera devida a Vibrio cholerae 01, biótipo cholerae' },
  { SUBCAT: 'A001', CLASSIF: '', DESCRICAO: 'Cólera devida a Vibrio cholerae 01, biótipo El Tor' },
  { SUBCAT: 'C000', CLASSIF: '', DESCRICAO: 'Neoplasia maligna do lábio superior' },
]

describe('formatarCodigoCid', () => {
  it('"A000" → "A00.0" (insere ponto)', () => {
    assert.equal(formatarCodigoCid('A000'), 'A00.0')
  })
  it('"A00" permanece sem ponto', () => {
    assert.equal(formatarCodigoCid('A00'), 'A00')
  })
  it('normaliza minúsculas e espaços', () => {
    assert.equal(formatarCodigoCid(' a000 '), 'A00.0')
  })
})

describe('montarCid10', () => {
  const payloads = montarCid10({ subcategorias, categorias, grupos, capitulos })

  it('monta categorias + subcategorias', () => {
    const codigos = payloads.map((p) => p.codigo)
    assert.ok(codigos.includes('A00'), 'deveria incluir categoria A00')
    assert.ok(codigos.includes('A00.0'), 'deveria incluir subcategoria A00.0')
    assert.equal(payloads.length, 5)
  })

  it('resolve capitulo e grupo por faixa', () => {
    const a00 = payloads.find((p) => p.codigo === 'A00')!
    assert.equal(a00.capitulo, 'Capítulo I - Algumas doenças infecciosas e parasitárias')
    assert.equal(a00.grupo, 'Doenças infecciosas intestinais')

    const c000 = payloads.find((p) => p.codigo === 'C00.0')!
    assert.equal(c000.capitulo, 'Capítulo II - Neoplasias [tumores]')
    assert.equal(c000.grupo, 'Neoplasias malignas de lábio, cavidade oral e faringe')
  })

  it('subcategoria herda capitulo/grupo da categoria (3 primeiros dígitos)', () => {
    const a000 = payloads.find((p) => p.codigo === 'A00.0')!
    assert.equal(a000.capitulo, 'Capítulo I - Algumas doenças infecciosas e parasitárias')
    assert.equal(a000.grupo, 'Doenças infecciosas intestinais')
  })

  it('remove duplicatas por código', () => {
    const duplicado = montarCid10({
      subcategorias: [...subcategorias, { SUBCAT: 'A000', DESCRICAO: 'duplicado' }],
      categorias,
      grupos,
      capitulos,
    })
    assert.equal(duplicado.filter((p) => p.codigo === 'A00.0').length, 1)
  })

  it('ordena por código', () => {
    const codigos = payloads.map((p) => p.codigo)
    const ordenado = [...codigos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    assert.deepEqual(codigos, ordenado)
  })
})
