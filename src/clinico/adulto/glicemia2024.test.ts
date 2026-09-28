import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DIFERENCAS_2024, TRATAMENTO_2024, bicarbonato2024, criteriosCad2024, criteriosEhh2024, fichaCadEhhAvaliacao, fichaCadEhhTratamento, fluido2024,
  gravidadeCad2024, insulina2024, osmolalidadeEfetiva2024, potassio2024, resolucaoCad2024, resolucaoEhh2024,
} from './glicemia.ts'

// Consenso ADA/EASD/JBDS/AACE/DTS 2024 (Diabetes Care 2024;47:1257–1275), lido no texto em 28/09/2026.

test('fichas de CAD/EHH: versão .1 de 28/09 com o manual e o consenso 2024 como fontes', () => {
  for (const f of [fichaCadEhhAvaliacao, fichaCadEhhTratamento]) {
    assert.equal(f.versao, '2026-09-28.1')
    assert.equal(f.fontes.length, 2)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência.*cap\. 64/)
    assert.match(f.fontes[1].citacao, /Hyperglycemic Crises in Adults With Diabetes.*2024;47\(8\):1257/)
    assert.equal(f.publico, 'adulto')
  }
})

test('CAD 2024 (Fig. 2A, p. 1262): glicose ≥ 200 OU DM prévio; BHB ≥ 3 ou cetonúria 2+; pH < 7,3 e/ou HCO3 < 18', () => {
  const r = criteriosCad2024({ glicemia: 210, dmPrevio: false, bhb: 3.2, ph: 7.2, hco3: 12 })!
  assert.deepEqual(r, { hiperglicemiaOuDm: true, cetose: true, acidose: true, preenche: true, euglicemica: false })
  // euglicêmica: glicose < 200 com DM prévio
  const e = criteriosCad2024({ glicemia: 160, dmPrevio: true, bhb: 4, ph: 7.35, hco3: 16 })!
  assert.equal(e.acidose, true) // HCO3 < 18 basta
  assert.equal(e.preenche, true)
  assert.equal(e.euglicemica, true)
  // sem DM prévio e glicose < 200: não preenche
  assert.equal(criteriosCad2024({ glicemia: 160, dmPrevio: false, bhb: 4, ph: 7.2, hco3: 12 })!.preenche, false)
  // cetose não informada → indeterminado
  assert.equal(criteriosCad2024({ glicemia: 300, dmPrevio: false, ph: 7.2, hco3: 12 })!.preenche, null)
  // cetonúria 2+ serve no lugar do BHB
  assert.equal(criteriosCad2024({ glicemia: 300, dmPrevio: false, cetonuria2mais: true, ph: 7.2, hco3: 12 })!.preenche, true)
  assert.equal(criteriosCad2024({ glicemia: 0, dmPrevio: false, ph: 7.2, hco3: 12 }), null)
})

test('EHH 2024 (Fig. 2B, p. 1262): glicose ≥ 600, osm efetiva > 300 (Na medido) ou total > 320, BHB < 3, pH ≥ 7,3 e HCO3 ≥ 15', () => {
  assert.equal(osmolalidadeEfetiva2024(140, 900), 2 * 140 + 50)
  const r = criteriosEhh2024({ glicemia: 900, osmEfetiva: 330, bhb: 1, ph: 7.35, hco3: 20 })!
  assert.deepEqual(r, { glicemia: true, hiperosmolar: true, semCetoseSignificativa: true, semAcidose: true, preenche: true })
  assert.equal(criteriosEhh2024({ glicemia: 900, osmEfetiva: 290, osmTotal: 325, bhb: 1, ph: 7.35, hco3: 20 })!.hiperosmolar, true)
  assert.equal(criteriosEhh2024({ glicemia: 900, osmEhh: 0, osmEfetiva: 330, bhb: 4, ph: 7.35, hco3: 20 } as never)!.preenche, false) // BHB ≥ 3 → CAD/EHH misto
  assert.equal(criteriosEhh2024({ glicemia: 900, osmEfetiva: 330, ph: 7.35, hco3: 20 })!.preenche, null) // cetose não informada
  assert.equal(criteriosEhh2024({ glicemia: 900, osmEfetiva: 330, bhb: 1, ph: 7.25, hco3: 20 })!.semAcidose, false)
})

test('gravidade 2024 (Tabela 2, p. 1263) por parâmetro e o pior', () => {
  assert.deepEqual(gravidadeCad2024({ bhb: 4, ph: 7.28, hco3: 16 }), { porBhb: 'leve', porPh: 'leve', porHco3: 'leve', pior: 'leve' })
  assert.deepEqual(gravidadeCad2024({ bhb: 7, ph: 7.1, hco3: 12 }), { porBhb: 'grave', porPh: 'moderada', porHco3: 'moderada', pior: 'grave' })
  assert.deepEqual(gravidadeCad2024({ ph: 6.95 }), { porBhb: null, porPh: 'grave', porHco3: null, pior: 'grave' })
  assert.deepEqual(gravidadeCad2024({ ph: 7.35, hco3: 20 }), { porBhb: null, porPh: null, porHco3: null, pior: null })
  assert.equal(gravidadeCad2024({ ph: 7.25 }).porPh, 'moderada') // 7,0–7,25 é moderada
  assert.equal(gravidadeCad2024({ hco3: 9.9 }).porHco3, 'grave')
})

test('resolução 2024 (Fig. 4, p. 1264): CAD = pH > 7,3 OU HCO3 > 18, E cetona < 0,6; EHH = osm < 300, diurese > 0,5 e glicose < 250', () => {
  assert.deepEqual(resolucaoCad2024(7.32, 16, 0.4), { acidoBase: true, cetona: true, resolvida: true })
  assert.deepEqual(resolucaoCad2024(7.25, 19, 0.4), { acidoBase: true, cetona: true, resolvida: true })
  assert.equal(resolucaoCad2024(7.32, 19, 0.8)!.resolvida, false)
  assert.equal(resolucaoCad2024(7.25, 16, 0.4)!.resolvida, false)
  assert.deepEqual(resolucaoEhh2024(295, 0.8, 240), { osm: true, diurese: true, glicemia: true, resolvido: true })
  assert.equal(resolucaoEhh2024(305, 0.8, 240)!.resolvido, false)
})

test('tratamento 2024: insulina 0,1 U/kg/h fixa (bolus só se atraso), 0,05 reduzida; K < 3,5 / 3,5–5 / > 5; bicarbonato só pH < 7,0; fluido 500–1.000 mL/h', () => {
  const i = insulina2024(70)!
  assert.equal(i.uH, 7)
  assert.equal(i.mlH, 35) // bomba do manual: 0,2 U/mL
  assert.equal(i.bolusSeAtrasoU, 7)
  assert.equal(i.reduzidaUH, 3.5)
  assert.equal(i.ehhUH, 3.5)
  assert.equal(insulina2024(0), null)
  assert.equal(potassio2024(3.4), 'baixo')
  assert.equal(potassio2024(3.5), 'medio')
  assert.equal(potassio2024(5.0), 'medio')
  assert.equal(potassio2024(5.1), 'alto')
  assert.equal(bicarbonato2024(6.95), true)
  assert.equal(bicarbonato2024(7.0), false)
  assert.equal(bicarbonato2024(6.92), true) // pelo manual (< 6,9) não seria
  assert.deepEqual(fluido2024(), { mlH: [500, 1000], totalEm2a4h: [1000, 4000], bolusFragilMl: 250 })
  assert.deepEqual(TRATAMENTO_2024.ehh.quedaGlicoseMax, [90, 120])
  assert.equal(TRATAMENTO_2024.transicao.basalUKg[1], 0.3)
  for (const d of DIFERENCAS_2024) assert.match(d.consenso, /p\. 1\d{3}/, d.tema)
})
