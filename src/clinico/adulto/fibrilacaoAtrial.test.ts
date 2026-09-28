import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  DILUICOES_FA, amiodaronaFa, digoxinaFa, diltiazemFa, edoxabanaClcrAlto, esmololFa, fichaFibrilacaoAtrialAdulto, janelaFa, propafenonaFa, varfarinaInicialMg, verapamilFa,
} from './fibrilacaoAtrial.ts'

const r2 = (x: number) => Math.round(x * 100) / 100

test('FA: ficha de adulto sem referência pediátrica', () => {
  assert.equal(fichaFibrilacaoAtrialAdulto.id, 'adulto-fibrilacao-atrial')
  assert.equal(fichaFibrilacaoAtrialAdulto.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(fichaFibrilacaoAtrialAdulto), false)
})

test('FA: concentrações da Tabela 3 conferem com o preparo (p. 253–254)', () => {
  assert.equal(2500 / 250, DILUICOES_FA.esmolol.mgMl) // 2.500 mg em 10 + 240 mL
  assert.equal((18 * 50) / 250, DILUICOES_FA.amiodarona.mgMl) // 18 mL de 50 mg/mL em 250 mL
  assert.ok(DILUICOES_FA.diltiazem.errata && DILUICOES_FA.amiodarona.errata)
})

test('FA: esmolol 70 kg — ataque 35 mg; 50–200 µg/kg/min = 3,5–14 mg/min = 21–84 mL/h a 10 mg/mL (p. 248)', () => {
  const e = esmololFa(70)!
  assert.equal(e.ataqueMg, 35)
  assert.deepEqual(e.manutUgMin, [3500, 14000])
  assert.deepEqual(e.manutMlH, [21, 84])
  assert.equal(esmololFa(0), null)
})

test('FA: verapamil 0,075–0,15 mg/kg e diltiazem 0,25 mg/kg; diltiazem 5–15 mg/h = 5–15 mL/h (p. 248)', () => {
  assert.deepEqual(verapamilFa(80)!.bolusMg.map(r2), [6, 12])
  const d = diltiazemFa(80)!
  assert.equal(d.bolusMg, 20)
  assert.deepEqual(d.manutMlH, [5, 15])
})

test('FA: digoxina — teto por peso 8–12 µg/kg x teto absoluto de 1 mg (p. 248)', () => {
  const d60 = digoxinaFa(60)!
  assert.deepEqual(d60.maximoPorPesoMg.map(r2), [0.48, 0.72])
  assert.deepEqual(d60.tetoMenorMg.map(r2), [0.48, 0.72])
  const d100 = digoxinaFa(100)!
  assert.deepEqual(d100.tetoMenorMg.map(r2), [0.8, 1]) // 1,2 mg limitado a 1 mg
})

test('FA: amiodarona 150 mg em 10 min; 0,5–1 mg/min = 8,33–16,67 mL/h a 3,6 mg/mL; 720–1.440 mg/24 h (p. 248, 254)', () => {
  const a = amiodaronaFa()
  assert.equal(a.ataqueMgMin, 15)
  assert.deepEqual(a.manutMlH.map(r2), [8.33, 16.67])
  assert.deepEqual(a.manut24hMg, [720, 1440])
})

test('FA: propafenona 450 mg abaixo de 70 kg e 600 mg a partir de 70 kg (p. 249)', () => {
  assert.equal(propafenonaFa(69.9), 450)
  assert.equal(propafenonaFa(70), 600)
  assert.equal(propafenonaFa(0), null)
})

test('FA: janela de 48 h — exatamente 48 h fica sinalizada; sem tempo conta como indeterminada (p. 248–249)', () => {
  assert.equal(janelaFa(12), 'menos-de-48h')
  assert.equal(janelaFa(48), 'exatamente-48h')
  assert.equal(janelaFa(72), 'mais-de-48h-ou-indeterminada')
  assert.equal(janelaFa(null), 'mais-de-48h-ou-indeterminada')
})

test('FA: varfarina 5 mg/d, 2,5 mg/d se idoso ou < 60 kg; edoxabana com ClCr ≥ 95 (p. 251)', () => {
  assert.equal(varfarinaInicialMg(70, false), 5)
  assert.equal(varfarinaInicialMg(59, false), 2.5)
  assert.equal(varfarinaInicialMg(70, true), 2.5)
  assert.equal(edoxabanaClcrAlto(95), true)
  assert.equal(edoxabanaClcrAlto(94), false)
})
