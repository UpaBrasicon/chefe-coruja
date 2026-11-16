// node --experimental-strip-types --test src/content/pilotoCalculadoras.test.ts
// Piloto das calculadoras (RT, 16/11/2026): toda chave do piloto e das
// relacionadas existe no registro da Central; nada de link quebrado.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { ESCORES_PILOTO, PILOTO_CALCULADORAS, RELACIONADAS } from './pilotoCalculadoras.ts'

const registro = readFileSync('src/content/registry.tsx', 'utf8')
const secoes = [...registro.matchAll(/slug: '([^']+)',\s*\n\s*label: '/g)].map((m) => ({ slug: m[1], inicio: m.index ?? 0 }))
const chaves = new Set<string>()
secoes.forEach((s, i) => {
  const trecho = registro.slice(s.inicio, i + 1 < secoes.length ? secoes[i + 1].inicio : registro.length)
  for (const m of trecho.matchAll(/\bt\('([^']+)'/g)) chaves.add(`${s.slug}/${m[1]}`)
})

test('registro lido: as 232 ferramentas da Central', () => {
  assert.equal(chaves.size, 232)
})

test('piloto: dez ferramentas, todas no registro', () => {
  assert.equal(PILOTO_CALCULADORAS.size, 10)
  for (const c of PILOTO_CALCULADORAS) assert.ok(chaves.has(c), `fora do registro: ${c}`)
})

test('piloto: os quatro escores da tela única batem com as chaves', () => {
  for (const id of ESCORES_PILOTO) assert.ok(PILOTO_CALCULADORAS.has(`escores/${id}`), id)
})

test('relacionadas: de 2 a 5 por ferramenta do piloto, todas no registro, sem a própria', () => {
  for (const c of PILOTO_CALCULADORAS) {
    const r = RELACIONADAS[c] ?? []
    assert.ok(r.length >= 2 && r.length <= 5, `${c}: ${r.length}`)
    for (const x of r) {
      assert.ok(chaves.has(x), `${c} → ${x} não existe`)
      assert.notEqual(x, c)
    }
  }
})
