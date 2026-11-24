// node --experimental-strip-types --test src/content/gruposSecoes.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { blocosComTemas, GRUPOS_SECAO, TEMAS, TIPO_FERRAMENTA, tipoDaFerramenta } from './gruposSecoes.ts'

// Lê as ferramentas de cada seção direto do texto do registry (que importa React).
const registry = readFileSync(join(import.meta.dirname, 'registry.tsx'), 'utf8')
function slugsDaSecao(secao: string): string[] {
  const a = registry.indexOf(`slug: '${secao}',`)
  const b = registry.indexOf('    ],', a)
  return [...registry.slice(a, b).matchAll(/t\('([a-z0-9-]+)'/g)].map((m) => m[1])
}

// Seções que aparecem juntas (SECOES_JUNTAS no registry): a seção exibida tem
// também as ferramentas das que ela absorve.
const juntas = registry.match(/SECOES_JUNTAS: Record<string, string> = \{([^}]*)\}/)?.[1] ?? ''
const absorvidasDe = (secao: string) =>
  [...juntas.matchAll(/([a-z-]+): '([a-z-]+)'/g)].filter((m) => m[2] === secao).map((m) => m[1])

for (const [secao, grupos] of Object.entries(GRUPOS_SECAO)) {
  test(`${secao}: toda ferramenta está em exatamente um grupo, e todo slug do grupo existe`, () => {
    const naSecao = [secao, ...absorvidasDe(secao)].flatMap(slugsDaSecao)
    assert.ok(naSecao.length > 0, 'seção não encontrada no registry')
    const nosGrupos = grupos.flatMap((g) => g.slugs)
    const repetidos = nosGrupos.filter((s, i) => nosGrupos.indexOf(s) !== i)
    assert.deepEqual(repetidos, [], 'slug em mais de um grupo')
    assert.deepEqual(naSecao.filter((s) => !nosGrupos.includes(s)), [], 'ferramenta sem grupo')
    assert.deepEqual(nosGrupos.filter((s) => !naSecao.includes(s)), [], 'slug de grupo que não existe na seção')
  })
}

test('emergencias: ITU do adulto no grupo Infecções (decisão do RT, 27/10/2026)', () => {
  const grupo = (rotulo: string) => GRUPOS_SECAO.emergencias.find((g) => g.rotulo === rotulo)
  assert.deepEqual(grupo('Infecções')?.slugs, ['itu-adulto'])
  assert.ok(!grupo('Digestivo, fígado e rim')?.slugs.includes('itu-adulto'))
})

// F2 (RT, 24/11/2026): temas e tipos só apontam para ferramentas que existem.
const existe = (chave: string) => {
  const [secao, slug] = chave.split('/')
  return slugsDaSecao(secao).includes(slug)
}

test('temas: toda chave existe no registry e nenhuma está em dois temas', () => {
  const todas = TEMAS.flatMap((t) => t.chaves)
  assert.deepEqual(todas.filter((c) => !existe(c)), [], 'chave de tema que não existe')
  assert.deepEqual(todas.filter((c, i) => todas.indexOf(c) !== i), [], 'chave em mais de um tema')
})

test('tipos: toda chave com tipo declarado existe no registry', () => {
  assert.deepEqual(Object.keys(TIPO_FERRAMENTA).filter((c) => !existe(c)), [])
  assert.equal(tipoDaFerramenta('escores', 'heart'), 'escore')
  assert.equal(tipoDaFerramenta('emergencias', 'hunt-hess'), 'escore')
  assert.equal(tipoDaFerramenta('calculadoras', 'qtc'), 'calculo')
  assert.equal(tipoDaFerramenta('emergencias', 'hsa-adulto'), 'conduta')
})

test('temas: HSA junta conduta e escores no lugar da conduta; outra seção entra como externa', () => {
  type F = { secao: string; slug: string }
  const f = (c: string): F => ({ secao: c.split('/')[0], slug: c.split('/')[1] })
  const grupos = [
    { rotulo: 'A', tools: ['emergencias/x', 'emergencias/hsa-adulto', 'emergencias/ottawa-hsa'].map(f) },
    { rotulo: 'B', tools: ['emergencias/hunt-hess', 'emergencias/y'].map(f) },
  ]
  const temas = [{ rotulo: 'HSA', chaves: ['emergencias/hsa-adulto', 'emergencias/hunt-hess', 'escores/z', 'emergencias/ottawa-hsa'] }]
  const r = blocosComTemas(grupos, (t) => `${t.secao}/${t.slug}`, (c) => (c === 'escores/z' ? f(c) : undefined), temas)
  const nomes = r.map((g) => g.blocos.map((b) => (b.tema ? `${b.tema}[${b.linhas.map((l) => (l.externa ? '+' : '') + l.tool.slug).join(',')}]` : b.linhas[0].tool.slug)))
  assert.deepEqual(nomes, [['x', 'HSA[hsa-adulto,hunt-hess,+z,ottawa-hsa]'], ['y']])
})

test('temas: tema sem ferramenta da seção não aparece; com uma só linha fica como estava', () => {
  const grupos = [{ rotulo: '', tools: ['a/um', 'a/dois'] }]
  const temas = [{ rotulo: 'Só fora', chaves: ['b/x', 'b/y'] }, { rotulo: 'Sozinho', chaves: ['a/um', 'b/nao-existe'] }]
  const r = blocosComTemas(grupos, (c) => c, () => undefined, temas)
  assert.deepEqual(r[0].blocos.map((b) => [b.tema ?? '', b.linhas.map((l) => l.tool)]), [['', ['a/um']], ['', ['a/dois']]])
})
