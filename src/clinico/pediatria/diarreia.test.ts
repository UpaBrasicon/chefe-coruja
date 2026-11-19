import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { CPS_ONDANSETRONA_2011, RERKSUPPAPHOL_ONDANSETRONA_2010 } from '../fontesPubmed.ts'
import {
  NOTA_ONDANSETRONA, ONDANSETRONA_LIVRO_MG_KG, classificarEscore, fichaDesidratacaoPed, grauPorPeso, ondansetronaMg, ondansetronaVoMg, planoA, planoB, planoC, racecadotrilaMgDose, zincoMgDia,
} from './diarreia.ts'

test('diarreia: ficha do livro do ICr (cap. 32)', () => {
  assert.equal(temReferenciaPediatrica(fichaDesidratacaoPed), true)
  assert.match(fichaDesidratacaoPed.fontes[0].citacao, /cap\. 32, p\. 326–334/)
})

test('grau pelo peso perdido: < 5% leve, 5–10% moderada, > 10% grave (p. 328)', () => {
  assert.equal(grauPorPeso(10, 9.6)!.grau, 'leve') // 4%
  assert.equal(grauPorPeso(10, 9.5)!.grau, 'moderada') // 5%
  assert.equal(grauPorPeso(10, 9)!.grau, 'moderada') // 10%
  assert.equal(grauPorPeso(10, 8.9)!.grau, 'grave') // 11%
  assert.equal(grauPorPeso(10, 11), null)
  assert.equal(grauPorPeso(0, 9), null)
})

test('escala clínica: 0 sem, 1–4 alguma, 5–8 grave (Tabela 1, p. 329)', () => {
  assert.deepEqual(classificarEscore([0, 0, 0, 0]), { escore: 0, classe: 'sem' })
  assert.equal(classificarEscore([1, 1, 1, 1])!.classe, 'alguma')
  assert.equal(classificarEscore([2, 2, 0, 0])!.classe, 'alguma')
  assert.equal(classificarEscore([2, 2, 1, 0])!.classe, 'grave')
  assert.equal(classificarEscore([2, 2, 2, 2])!.escore, 8)
  assert.equal(classificarEscore([3, 0, 0, 0]), null)
  assert.equal(classificarEscore([1, 1]), null)
})

test('plano A por idade (p. 330)', () => {
  assert.deepEqual(planoA(1.5)!.faixaMl, [50, 100])
  assert.deepEqual(planoA(2)!.faixaMl, [100, 200])
  assert.deepEqual(planoA(10)!.faixaMl, [100, 200])
  assert.equal(planoA(11)!.faixaMl, null)
})

test('plano B: SRO 75 mL/kg em 4 h (p. 330)', () => {
  assert.deepEqual(planoB(10), { totalMl: 750, mlH: 187.5 })
  assert.equal(planoB(0), null)
})

test('plano C: ESPGHAN 20 mL/kg/h por 2–4 h; OMS 100 mL/kg em 3–6 h (p. 330)', () => {
  const c = planoC(10)!
  assert.equal(c.espghan.mlH, 200)
  assert.deepEqual(c.espghan.totalMl, [400, 800])
  assert.equal(c.oms.totalMl, 1000)
  assert.equal(Math.round(c.oms.mlH[0]), 167)
  assert.equal(Math.round(c.oms.mlH[1]), 333)
})

test('medicações do capítulo por peso/idade (p. 331)', () => {
  assert.equal(Math.round(ondansetronaMg(12)! * 100) / 100, 1.8) // IV 0,15 mg/kg (lote D11); o livro dava 0,1 mg/kg
  assert.equal(zincoMgDia(3), 10)
  assert.equal(zincoMgDia(8), 20)
  assert.equal(zincoMgDia(6), null)
  assert.equal(racecadotrilaMgDose(10), 15)
})

// ── Lote D11 (decisão do RT de 19/11/2026): item 13 ──

test('lote D11: ondansetrona IV 0,15 mg/kg (máx. 8 mg) e VO por faixa de peso; o livro fica na nota', () => {
  assert.equal(fichaDesidratacaoPed.versao, '2026-11-19.1')
  for (const f of [RERKSUPPAPHOL_ONDANSETRONA_2010, CPS_ONDANSETRONA_2011]) assert.ok(fichaDesidratacaoPed.fontes.includes(f))
  assert.match(fichaDesidratacaoPed.revisadoEm, /^19\/11\/2026 \(lote D11: item 13/)
  // IV: 0,15 mg/kg, máximo 8 mg (Rerksuppaphol 2010)
  assert.equal(Math.round(ondansetronaMg(20)! * 100) / 100, 3)
  assert.equal(ondansetronaMg(70), 8)
  assert.equal(ondansetronaMg(0), null)
  // VO (Sociedade Canadense de Pediatria 2011): 8–15 kg 2 mg; > 15–30 kg 4 mg; > 30 kg 6–8 mg
  assert.equal(ondansetronaVoMg(7.9), null)
  assert.deepEqual(ondansetronaVoMg(8), [2, 2])
  assert.deepEqual(ondansetronaVoMg(15), [2, 2])
  assert.deepEqual(ondansetronaVoMg(15.1), [4, 4])
  assert.deepEqual(ondansetronaVoMg(30), [4, 4])
  assert.deepEqual(ondansetronaVoMg(31), [6, 8])
  // o valor do livro continua registrado
  assert.equal(ONDANSETRONA_LIVRO_MG_KG, 0.1)
  assert.match(NOTA_ONDANSETRONA, /O livro dá 0,1 mg\/kg, sem dose máxima \(p\. 331\)/)
})
