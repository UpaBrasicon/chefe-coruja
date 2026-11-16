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

test('CURB-65: os três passos da ATS/IDSA valem em qualquer pontuação (a diretriz não os separa pelo CURB-65)', () => {
  for (const e of [0, 1, 2] as const) assert.equal(passosDaFaixa(GUIAS['curb-65'], e).length, 3)
})

test('sepse: antimicrobiano em qualquer faixa; corticoide e vasopressor só no choque', () => {
  const temas = (e: 0 | 1 | 2) => passosDaFaixa(GUIAS['sepse-adulto'], e).map((p) => p.tema ?? '')
  assert.ok(temas(0).some((t) => t.startsWith('Antimicrobiano')))
  assert.ok(!temas(1).some((t) => t.startsWith('Corticoide')))
  assert.ok(temas(2).some((t) => t.startsWith('Corticoide')))
  assert.ok(temas(2).some((t) => t.startsWith('Vasopressor')))
})

test('piloto: as 10 ferramentas têm guia; Glasgow separa o TCE grave do leve', () => {
  for (const id of ['heart', 'curb-65', 'sepse-adulto', 'glasgow', 'adulto-isr', 'adulto-infusoes', 'adulto-reposicao-potassio', 'adulto-pcr', 'ped-bolus', 'ped-diarreia-desidratacao']) {
    assert.ok((GUIAS[id]?.proximosPassos ?? []).length > 0, id)
  }
  const temas = (e: 0 | 1 | 2) => passosDaFaixa(GUIAS.glasgow, e).map((p) => p.tema ?? '')
  assert.ok(temas(2).includes('TCE grave: neurocirurgia'))
  assert.ok(!temas(0).includes('TCE grave: neurocirurgia'))
  assert.ok(!temas(2).includes('Tomografia no TCE leve e moderado'))
})
