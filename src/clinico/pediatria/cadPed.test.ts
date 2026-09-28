import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  anionGapCad, bicarbonatoCad, criteriosCad, criteriosEhh, doseInsulinaPeloLivro, edemaCerebral, expansaoChoqueCad, expansaoEhh, fichaCadPed, gravidadeCad,
  hidratacaoCad, insulinaEhhUiH, insulinaEv, insulinaScIcr, kMaxMeqH, kclOralMeqDia, magnesioEhh, nphIcr, osmEfetivaCad, pushGlicose25, sodioRealCad, todosAtendem,
} from './cadPed.ts'

const r1 = (x: number | null | undefined) => Math.round(x! * 10) / 10

test('CAD: ficha do ICr (cap. 52)', () => {
  assert.equal(temReferenciaPediatrica(fichaCadPed), true)
  assert.match(fichaCadPed.fontes[0].citacao, /cap\. 52, p\. 512–526/)
})

test('critérios de CAD (Quadro 2, p. 515): corte do bic 15 (BSPED/NICE) ou 18 (ISPAD)', () => {
  const g = { glicemia: 400, ph: 7.25, bic: 16, cetonemia: 4 }
  assert.equal(todosAtendem(criteriosCad(g, 15)), false)
  assert.equal(todosAtendem(criteriosCad(g, 18)), true)
  assert.equal(todosAtendem(criteriosCad({ glicemia: 400, ph: 7.25, bic: 12 }, 15)), null) // cetose não informada
  assert.equal(todosAtendem(criteriosCad({ glicemia: 400, ph: 7.25, bic: 12, cetonuria2mais: true }, 15)), true)
})

test('critérios de EHH (Quadro 2): glicemia > 600, pH > 7,3 arterial / > 7,25 venoso, bic > 15, osm > 320', () => {
  const g = { glicemia: 800, ph: 7.28, bic: 18, cetonemia: 1, osm: 340 }
  assert.equal(todosAtendem(criteriosEhh(g)), false) // arterial 7,28 não passa de 7,3
  assert.equal(todosAtendem(criteriosEhh({ ...g, venoso: true })), true)
})

test('gravidade da CAD (Quadro 3, p. 515–516)', () => {
  assert.equal(gravidadeCad(7.32, 17, 18), 'leve')
  assert.equal(gravidadeCad(7.32, 17, 15), null)
  assert.equal(gravidadeCad(7.15, 12, 15), 'moderada')
  assert.equal(gravidadeCad(7.3, 9, 15), 'moderada')
  assert.equal(gravidadeCad(7.05, 12, 15), 'grave')
  assert.equal(gravidadeCad(7.2, 4, 15), 'grave')
})

test('Quadro 6 (p. 517): Na real, osmolalidade efetiva, ânion-gap', () => {
  assert.equal(sodioRealCad(130, 500), 138)
  assert.equal(osmEfetivaCad(138, 540), 306)
  assert.equal(anionGapCad(138, 100, 8), 30)
})

test('fluidos (p. 518; Figura 3): choque 20 mL/kg em 20 min com teto de 1.000 mL/h; 20 e 10 mL/kg/h', () => {
  const c10 = expansaoChoqueCad(10)!
  assert.equal(c10.mlH, 600)
  assert.equal(c10.noTeto, false)
  assert.equal(r1(c10.minutos), 20)
  const c30 = expansaoChoqueCad(30)! // 600 mL em 20 min = 1.800 mL/h → teto 1.000 → 36 min
  assert.equal(c30.mlH, 1000)
  assert.equal(c30.noTeto, true)
  assert.equal(r1(c30.minutos), 36)
  const h = hidratacaoCad(60)!
  assert.equal(h[0].mlH, 1000)
  assert.equal(h[0].noTeto, true)
  assert.equal(h[1].mlH, 600)
  assert.deepEqual(pushGlicose25(15), [15, 30])
})

test('potássio (Quadro 8): teto por hora e KCl oral 4 mEq/kg/dia', () => {
  assert.equal(kMaxMeqH(20, 0.5), 10)
  assert.equal(kMaxMeqH(20, 1), 20)
  assert.equal(kclOralMeqDia(20), 80)
})

test('insulina (p. 521–522): 0,05–0,1 UI/kg/h, 0,1 UI/mL; esquema SC do ICr; NPH 0,3 UI/kg', () => {
  assert.deepEqual(insulinaEv(20, 0.1), { uiH: 2, mlH: 20 })
  assert.deepEqual(insulinaEv(20, 0.05), { uiH: 1, mlH: 10 })
  assert.equal(doseInsulinaPeloLivro(['menor5']).uiKgH, 0.05)
  assert.equal(doseInsulinaPeloLivro(['adolescente']).uiKgH, 0.1)
  assert.equal(doseInsulinaPeloLivro(['menor5', 'grave']).uiKgH, null)
  assert.equal(doseInsulinaPeloLivro([]).uiKgH, null)
  const sc = insulinaScIcr(20)!
  assert.equal(r1(sc.inicial), 3)
  assert.equal(sc.reduzida, 2)
  assert.equal(r1(nphIcr(20)), 6)
})

test('bicarbonato na CAD (p. 522): (15 − bic) × 0,3 × peso; 1–2 mEq/kg', () => {
  const b = bicarbonatoCad(20, 3)!
  assert.equal(r1(b.formula), 72)
  assert.deepEqual(b.porKg, [20, 40])
  assert.equal(bicarbonatoCad(20, 16)!.formula, null)
})

test('edema cerebral (Quadro 11, p. 524)', () => {
  const e = edemaCerebral(20)!
  assert.deepEqual(e.manitolG, [10, 20])
  assert.deepEqual(e.nacl3Ml, [50, 100])
})

test('EHH (p. 522–523; Figura 4): expansão, insulina 0,025–0,05 UI/kg/h, magnésio', () => {
  const e = expansaoEhh(30)!
  assert.equal(e.texto.mlH, 600)
  assert.equal(e.choqueFigura4.mlH, 1000)
  assert.equal(e.choqueFigura4.noTeto, true)
  assert.deepEqual(insulinaEhhUiH(40), [1, 2])
  const mg = magnesioEhh(40)! // 1.000–2.000 mg; 150 mg/min ou 2 g/h → o mais lento
  assert.deepEqual(mg.mg, [1000, 2000])
  assert.deepEqual(mg.minutosMin, [30, 60])
})
