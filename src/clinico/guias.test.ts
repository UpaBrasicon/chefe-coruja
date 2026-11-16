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

test('gastro: Glasgow-Blatchford 0–1 traz a alta sem EDA; risco maior traz o manejo inicial da HDA', () => {
  const temas = (e: 0 | 1 | 2) => passosDaFaixa(GUIAS['glasgow-blatchford'], e).map((p) => p.tema ?? '')
  assert.ok(temas(0).includes('Glasgow-Blatchford'))
  assert.ok(!temas(0).includes('Transfusão (úlcera)'))
  assert.ok(temas(2).includes('Transfusão (úlcera)'))
  assert.ok(!temas(2).includes('Glasgow-Blatchford'))
  assert.equal(passosDaFaixa(GUIAS['child-pugh'], 0).length, 2)
  assert.equal(passosDaFaixa(GUIAS['child-pugh'], 2).length, 3)
})

test('pancreatite e apendicite: BISAP de 3 ou mais pede cuidado intermediário; Alvarado baixo não traz cirurgia', () => {
  const bisap = (e: 0 | 1 | 2) => passosDaFaixa(GUIAS.bisap, e).map((p) => p.tema ?? '')
  assert.ok(bisap(2).some((t) => t.startsWith('BISAP de 3')))
  assert.ok(!bisap(1).some((t) => t.startsWith('BISAP de 3')))
  assert.equal(passosDaFaixa(GUIAS.ranson, 0).length, passosDaFaixa(GUIAS.ranson, 2).length)
  const alv = (e: 0 | 1 | 2) => passosDaFaixa(GUIAS.alvarado, e).map((p) => p.tema ?? '')
  assert.deepEqual(alv(0), ['Escore para excluir'])
  assert.ok(alv(1).includes('Risco intermediário: imagem'))
  assert.ok(alv(2).includes('Via laparoscópica'))
  assert.ok(!alv(1).includes('Via laparoscópica'))
})
