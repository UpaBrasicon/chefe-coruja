import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  AHA_2025_PCR, AHA_ALS_2025, DIRETRIZ_ALS_2025, lidocainaSegundaDoseMg,
  ADRENALINA_BRADI, BCC_EV, CHOQUE_PCR, DROGAS_PCR, KCL_ATAQUE_MEQ, LIDOCAINA_TV, MAGNESIO_TORSADES,
  adenosina, adrenalinaBradiMlH, adrenalinaUnidadeImpressaUgMin, calcularPcr, dopaminaUgMin, esquemaAmiodarona, esquemaAtropina,
  fichaBradicardiaAdulto, fichaPcrAdulto, fichaTaquiarritmiaAdulto, lidocainaTv,
} from './pcr.ts'

test('arritmias/PCR: três fichas de adulto, ids distintos, sem referência pediátrica', () => {
  const fichas = [fichaPcrAdulto, fichaBradicardiaAdulto, fichaTaquiarritmiaAdulto]
  assert.equal(new Set(fichas.map((f) => f.id)).size, 3)
  for (const f of fichas) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('PCR: cargas de 360 J (monofásico) e 200 J (bifásico), p. 48', () => {
  assert.deepEqual([CHOQUE_PCR.monofasicoJ, CHOQUE_PCR.bifasicoJ], [360, 200])
})

test('PCR: doses fixas da Tabela 2 conferidas no texto (p. 49–51)', () => {
  const d = (id: string) => DROGAS_PCR.find((x) => x.id === id)!
  assert.match(d('adrenalina').dose, /^1 mg .*3 a 5 minutos/)
  assert.match(d('amiodarona').dose, /300 mg.*150 mg/)
  assert.match(d('kcl').dose, /2 mEq\/min durante 10 minutos/)
  assert.ok(d('kcl').errata)
  assert.equal(KCL_ATAQUE_MEQ, 20)
  for (const x of DROGAS_PCR) assert.match(x.pagina, /^p\. (49|50|51)$/, x.id)
})

test('PCR: doses por peso (70 kg) — lidocaína, bicarbonato e emulsão lipídica', () => {
  const r = calcularPcr(70)!
  assert.deepEqual(r.lidocainaMg, [70, 105])
  assert.deepEqual(r.bicarbonatoMEq, [70, 105])
  assert.deepEqual(r.bicarbonatoAdicionalMEq, [35, 52.5])
  assert.equal(r.emulsaoBolusMl, 105)
  assert.equal(r.emulsaoMlMin, 17.5)
  assert.equal(r.emulsaoMlH, 1050)
  assert.deepEqual(r.emulsaoInfusaoMl, [525, 1050])
  assert.equal(calcularPcr(0), null)
})

test('bradicardia: atropina 0,5 mg a cada 3 min até 3 mg = 6 doses em 15 min (p. 229)', () => {
  assert.deepEqual(esquemaAtropina(), { doses: 6, minutosAteUltima: 15 })
})

test('bradicardia: errata p. 229 — adrenalina em µg/min, não µg/kg/min', () => {
  assert.deepEqual(ADRENALINA_BRADI.ugMin, [2, 10])
  assert.match(ADRENALINA_BRADI.errata, /µg\/kg\/min/)
  assert.deepEqual(adrenalinaBradiMlH(), [2, 10]) // preparo do Anexo 1: 60 µg/mL
  // a unidade impressa daria 140–700 µg/min em 70 kg: acima do teto do anexo (20 µg/min)
  const errado = adrenalinaUnidadeImpressaUgMin(70)!
  assert.deepEqual(errado, [140, 700])
  assert.ok(errado[0] > 20)
})

test('bradicardia: dopamina 5–20 µg/kg/min em µg/min (p. 229)', () => {
  assert.deepEqual(dopaminaUgMin(80), [400, 1600])
  assert.equal(dopaminaUgMin(0), null)
})

test('taquiarritmias: adenosina 6 → 12 → 12 mg; metade em acesso central (p. 265)', () => {
  assert.deepEqual(adenosina(false), [6, 12, 12])
  assert.deepEqual(adenosina(true), [3, 6, 6])
})

test('taquiarritmias: amiodarona 150 mg + 1 mg/min × 6 h + 0,5 mg/min × 18 h = 1.050 mg em 24 h (p. 265)', () => {
  const a = esquemaAmiodarona()
  assert.deepEqual(a.fases.map((f) => f.mg), [150, 360, 540])
  assert.equal(a.total24hMg, 1050)
})

test('taquiarritmias: lidocaína 0,7–1,4 mg/kg a 50 mg/min; teto 200–300 mg/h (p. 265)', () => {
  const l = lidocainaTv(70)!
  assert.deepEqual(l.ataqueMg.map((x) => Math.round(x * 10) / 10), [49, 98])
  assert.deepEqual(l.minutos.map((x) => Math.round(x * 100) / 100), [0.98, 1.96])
  assert.equal(l.doisAtaquesPassamDe200, false) // 2 × 98 = 196
  assert.equal(lidocainaTv(80)!.doisAtaquesPassamDe200, true) // 2 × 112 = 224
  assert.ok(LIDOCAINA_TV.errata)
})

test('taquiarritmias: verapamil 1 mg/min até 20 mg, diltiazem 2,5 mg/min até 50 mg; magnésio 2 g em 15 min (p. 266)', () => {
  assert.deepEqual(BCC_EV.map((b) => b.minutosAteTotal), [20, 20])
  assert.deepEqual([MAGNESIO_TORSADES.g, MAGNESIO_TORSADES.minutos], [2, 15])
})

// ── AHA 2025, Part 9 (lacunas da Central, lote 3) ──

test('PCR adulto: ficha nova com o Part 9 da AHA 2025 ao lado do manual', () => {
  assert.equal(fichaPcrAdulto.versao, '2026-10-25.1')
  assert.equal(fichaPcrAdulto.fontes.length, 2)
  assert.match(fichaPcrAdulto.fontes[0].citacao, /p\. 48–51/)
  assert.equal(fichaPcrAdulto.fontes[1], AHA_ALS_2025)
  assert.match(AHA_ALS_2025.citacao, /S538–S577/)
})
test('PCR adulto: Figura 2 da AHA 2025 confere com a Tabela 2 do manual', () => {
  assert.equal(AHA_2025_PCR.monofasicoJ, CHOQUE_PCR.monofasicoJ)
  assert.deepEqual(AHA_2025_PCR.bifasicoJ, [120, 200])
  assert.deepEqual(AHA_2025_PCR.amiodaronaMg, [300, 150])
  assert.match(DROGAS_PCR.find((d) => d.id === 'amiodarona')!.dose, /300 mg.*150 mg/)
  assert.deepEqual(AHA_2025_PCR.lidocainaMgKg.primeira, [1, 1.5])
})
test('PCR adulto: segunda dose de lidocaína 0,5–0,75 mg/kg (70 kg = 35–52,5 mg)', () => {
  assert.deepEqual(lidocainaSegundaDoseMg(70), [35, 52.5])
  assert.equal(lidocainaSegundaDoseMg(0), null)
})
test('PCR adulto: comparação com a AHA 2025 cita a seção em cada tema', () => {
  assert.ok(DIRETRIZ_ALS_2025.length >= 6)
  for (const d of DIRETRIZ_ALS_2025) assert.match(d.onde, /seç(ão|ões) \d+/)
  assert.match(DIRETRIZ_ALS_2025.find((d) => /dupla desfibrilação/.test(d.tema))!.aha, /não está estabelecida/)
})
