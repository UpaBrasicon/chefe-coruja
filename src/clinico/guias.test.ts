// node --experimental-strip-types --test src/clinico/guias.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { passosDaFaixa } from './guia.ts'
import { GUIAS } from './guias.ts'

test('guias: todo passo e toda evidência têm texto e fonte', () => {
  for (const [id, g] of Object.entries(GUIAS)) {
    for (const p of [...(g.proximosPassos ?? []), ...(g.evidencias ?? []), ...(g.armadilhas ?? [])]) {
      assert.ok(p.texto.trim().length > 10, `${id}: texto vazio`)
      assert.ok(p.ref.fonte.trim().length > 0, `${id}: sem fonte`)
    }
  }
})

test('HEART: baixo risco traz a alta do baixo risco; alto risco não traz', () => {
  const temas = (e: 0 | 1 | 2) => passosDaFaixa(GUIAS.heart, e).map((p) => p.tema)
  assert.ok(temas(0).includes('Alta do baixo risco'))
  assert.ok(temas(0).includes('Dosagem única de troponina'))
  assert.ok(!temas(2).includes('Alta do baixo risco'))
  assert.ok(!temas(2).includes('Dosagem única de troponina'))
  assert.ok(temas(2).includes('Antiagregação antes do diagnóstico'))
})
