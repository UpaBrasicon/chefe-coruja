import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  ALTA, SINAIS_ALARME, antitromboticoDengue, bicarbonatoDengue, cardiopataDengue, fichaDengue, grupoDPorPeso, grupoDengue, hidratacaoAdulto, hipocalemiaDengue, hiponatremiaDengue,
  provaDoLaco,
} from './dengue.ts'
import { temReferenciaPediatrica } from './ficha.ts'
import { analgesicosMs2024, fichaDenguePed, grupoCMs2024, pasP5Ms, pesoAproximadoMs } from './pediatria/denguePed.ts'

// Dengue pelo manual do MS 6ª ed. 2024 (28/09/2026).

test('dengue adulto: ficha .1 com o MS 2024 citado com páginas; continua de adulto', () => {
  assert.equal(fichaDengue.versao, '2026-09-28.1')
  assert.match(fichaDengue.fontes[0].citacao, /6ª ed.*2024.*p\. 27/)
  assert.equal(temReferenciaPediatrica(fichaDengue), false)
})

test('MS 2024: condição especial, risco social ou comorbidade põem no grupo B; aumento do Ht é sinal de alarme', () => {
  const nada = { sangramentoPele: false, sangramentoMucosa: false, sinaisAlarme: 0, sinaisChoque: 0 }
  assert.equal(grupoDengue(nada), 'A')
  assert.equal(grupoDengue({ ...nada, condicaoEspecial: true }), 'B')
  assert.equal(grupoDengue({ ...nada, condicaoEspecial: true, sinaisAlarme: 1 }), 'C')
  assert.ok(SINAIS_ALARME.includes('Aumento progressivo do hematócrito'))
  assert.equal(ALTA.length, 5)
})

test('MS 2024: grupo C 10 mL/kg na 1ª hora e manutenção 25 mL/kg em 6 h e 8 h com mL/h; grupo D 20 mL/kg em 20 min', () => {
  const c = hidratacaoAdulto('C', 60)
  assert.equal(c[0].volumeMl, 600)
  assert.equal(c[3].mlH, 250)
  assert.equal(c[4].mlH, 188)
  const d = hidratacaoAdulto('D', 60)
  assert.equal(d[0].volumeMl, 1200)
  assert.equal(d[0].mlH, 3600)
})

test('MS 2024 grupo D por peso: albumina 0,5–1 g/kg a 5%, CH 10–15 mL/kg/dia, plasma 10 mL/kg, crio 1 U/5–10 kg', () => {
  const d = grupoDPorPeso(60)!
  assert.deepEqual(d.albuminaG, [30, 60])
  assert.deepEqual(d.albumina5Ml, [600, 1200])
  assert.deepEqual(d.albumina20Ml, [150, 300])
  assert.deepEqual(d.concentradoHemaciasMlDia, [600, 900])
  assert.equal(d.plasmaMl, 600)
  assert.deepEqual(d.crioU, [6, 12])
  assert.equal(grupoDPorPeso(0), null)
})

test('MS 2024 eletrólitos: hiponatremia, hipocalemia e bicarbonato com os critérios do manual', () => {
  const na = hiponatremiaDengue(115, 60)!
  assert.equal(na.mEq, 540)
  assert.ok(Math.abs(na.mlNaCl3 - 540 / 0.51) < 1e-9)
  assert.equal(na.indicada, true)
  assert.equal(hiponatremiaDengue(125, 60)!.indicada, false)
  assert.equal(hiponatremiaDengue(135, 60), null)
  assert.deepEqual(hipocalemiaDengue(2.3, 50)!.mEqH, [10, 20])
  const b = bicarbonatoDengue(8, 7.1, 60)!
  assert.deepEqual(b.mEq.map((x) => Math.round(x)), [168, 336])
  assert.equal(b.indicado, true)
  assert.equal(bicarbonatoDengue(14, 7.3, 60)!.indicado, false)
})

test('MS 2024 cardiopata: NYHA II 15 mL/kg e III 10 mL/kg em 30 min; manutenção 15–25 mL/kg a cada 12 h; IV UTI', () => {
  assert.equal(cardiopataDengue(2, 70).volumeMl, 1050)
  assert.equal(cardiopataDengue(3, 70).volumeMl, 700)
  assert.deepEqual(cardiopataDengue(2, 70).manutencao12hMl, [1050, 1750])
  assert.equal(cardiopataDengue(4, 70).volumeMl, null)
})

test('MS 2024 antitrombóticos: cortes de 30 e 50 mil plaquetas', () => {
  assert.match(antitromboticoDengue('dapt-stent-recente', 60_000)!, /Manter AAS e clopidogrel/)
  assert.match(antitromboticoDengue('dapt-stent-recente', 40_000)!, /observação/)
  assert.match(antitromboticoDengue('aas', 20_000)!, /Suspender o AAS/)
  assert.match(antitromboticoDengue('varfarina', 40_000)!, /heparina não fracionada/)
  assert.match(antitromboticoDengue('doac', 40_000)!, /24 h após a última dose/)
  assert.equal(antitromboticoDengue('aas', 0), null)
})

test('MS 2024 prova do laço (PAS + PAD) / 2', () => {
  assert.equal(provaDoLaco(100, 60), 80)
  assert.equal(provaDoLaco(60, 100), null)
})

test('dengue criança: MS 2024 ao lado do livro — grupo C, analgésicos, peso aproximado e PAS p5', () => {
  assert.equal(fichaDenguePed.versao, '2026-09-28.1')
  assert.equal(temReferenciaPediatrica(fichaDenguePed), true)
  const c = grupoCMs2024(20)!
  assert.equal(c.hora1Ml, 200)
  assert.equal(c.maxFaseMl, 400)
  assert.equal(c.manut6hMlH, 500 / 6)
  assert.deepEqual(analgesicosMs2024(15), { dipironaMg: 150, paracetamolMg: 150 })
  assert.equal(pesoAproximadoMs(6), 7.5)
  assert.equal(pesoAproximadoMs(48), 16.5)
  assert.equal(pesoAproximadoMs(120), null)
  assert.equal(pasP5Ms(4), 78)
  assert.equal(pasP5Ms(12), null)
})
