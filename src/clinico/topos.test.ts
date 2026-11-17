// node --experimental-strip-types --test src/clinico/topos.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { TOPOS, topoDa } from './topos.ts'
import { ESCORES } from './escores/index.ts'
import { ROTA_DA_FICHA } from './indice.ts'

test('topo: toda frase das abas tem fonte, e o resumo é uma frase só', () => {
  for (const [id, t] of Object.entries(TOPOS)) {
    for (const i of [...(t.quandoUsar ?? []), ...(t.porQueUsar ?? [])]) {
      assert.ok(i.texto.length > 10, id)
      assert.ok(i.ref.fonte.length > 3, id)
    }
    // frase nova = ponto seguido de maiúscula ("cap. 37" e "p. 12" não contam)
    if (t.resumo) assert.equal(t.resumo.split(/\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).length, 1, `${id}: resumo com mais de uma frase`)
  }
})

test('topo: piloto nos quatro escores do piloto, com ids de ficha que existem', () => {
  const ids = new Set(ESCORES.map((e) => e.ficha.id))
  for (const id of ['heart', 'curb-65', 'sepse-adulto', 'glasgow']) {
    assert.ok(topoDa(id)?.resumo, id)
    assert.ok(ids.has(id), id)
  }
})

test('topo: toda chave é id de ficha que existe (escore ou conduta com rota)', () => {
  const ids = new Set(ESCORES.map((e) => e.ficha.id))
  for (const id of Object.keys(TOPOS)) assert.ok(ids.has(id) || id in ROTA_DA_FICHA, id)
  for (const id of ['adulto-isr', 'adulto-infusoes', 'adulto-reposicao-potassio', 'adulto-pcr', 'ped-bolus', 'ped-diarreia-desidratacao']) assert.ok(topoDa(id)?.resumo, id)
  assert.ok(Object.keys(TOPOS).length >= 46)
})
