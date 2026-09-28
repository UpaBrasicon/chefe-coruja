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

for (const [secao, grupos] of Object.entries(GRUPOS_SECAO)) {
  test(`${secao}: toda ferramenta está em exatamente um grupo, e todo slug do grupo existe`, () => {
    const naSecao = slugsDaSecao(secao)
    assert.ok(naSecao.length > 0, 'seção não encontrada no registry')
    const nosGrupos = grupos.flatMap((g) => g.slugs)
    const repetidos = nosGrupos.filter((s, i) => nosGrupos.indexOf(s) !== i)
    assert.deepEqual(repetidos, [], 'slug em mais de um grupo')
    assert.deepEqual(naSecao.filter((s) => !nosGrupos.includes(s)), [], 'ferramenta sem grupo')
    assert.deepEqual(nosGrupos.filter((s) => !naSecao.includes(s)), [], 'slug de grupo que não existe na seção')
  })
}
