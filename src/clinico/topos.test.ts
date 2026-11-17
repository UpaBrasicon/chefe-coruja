// node --experimental-strip-types --test src/clinico/topos.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { TOPOS, topoDa } from './topos.ts'
import { ESCORES } from './escores/index.ts'

test('topo: toda frase das abas tem fonte, e o resumo é uma frase só', () => {
  for (const [id, t] of Object.entries(TOPOS)) {
    for (const i of [...(t.quandoUsar ?? []), ...(t.porQueUsar ?? [])]) {
      assert.ok(i.texto.length > 10, id)
      assert.ok(i.ref.fonte.length > 3, id)
    }
    if (t.resumo) assert.equal(t.resumo.split('. ').length, 1, `${id}: resumo com mais de uma frase`)
  }
})

test('topo: piloto nos quatro escores do piloto, com ids de ficha que existem', () => {
  const ids = new Set(ESCORES.map((e) => e.ficha.id))
  for (const id of ['heart', 'curb-65', 'sepse-adulto', 'glasgow']) {
    assert.ok(topoDa(id)?.resumo, id)
    assert.ok(ids.has(id), id)
  }
})
