// node --experimental-strip-types --test src/content/gruposSecoes.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { GRUPOS_SECAO } from './gruposSecoes.ts'

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
