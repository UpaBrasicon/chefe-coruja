import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  LIMITES_CORRECAO_HIPO, SOLUCOES_NA, bolusNaCl3Ml, deficitAguaLivrePed, diferencaOsmolar, elevacaoNaCl3, fichaSodioPed, horasMinimasHiper, litrosParaVariacao,
  osmEfetiva, sg5RapidoMl, sodioCorrigidoPed, tonicidadePed, variacaoNaPorLitro,
} from './sodioPed.ts'

const r1 = (x: number | null) => Math.round(x! * 10) / 10
const naSol = (id: string) => SOLUCOES_NA.find((s) => s.id === id)!.naMeqL

test('sódio ped: ficha do ICr (cap. 54)', () => {
  assert.equal(temReferenciaPediatrica(fichaSodioPed), true)
  assert.match(fichaSodioPed.fontes[0].citacao, /cap\. 54/)
})

test('sódio corrigido: +2 mEq/L a cada 100 mg/dL acima de 100 (p. 534 e 517) — diferente do 1,6 do manual de adulto', () => {
  assert.equal(sodioCorrigidoPed(130, 100), 130)
  assert.equal(sodioCorrigidoPed(130, 600), 140)
  assert.equal(sodioCorrigidoPed(130, 80), 130)
  assert.equal(sodioCorrigidoPed(0, 600), null)
})

test('osmolalidade efetiva = 2 × Na + glicose/18 (p. 537) e tonicidade (p. 533–534)', () => {
  assert.equal(osmEfetiva(140, 90), 285)
  assert.equal(tonicidadePed(291), 'hipertonica')
  assert.equal(tonicidadePed(290), 'isotonica')
  assert.equal(tonicidadePed(275), 'isotonica')
  assert.equal(tonicidadePed(274), 'hipotonica')
  assert.equal(diferencaOsmolar(340, 285)!.acimaDe50, true)
  assert.equal(diferencaOsmolar(320, 285)!.acimaDe50, false)
})

test('NaCl 3%: 2 mL/kg, máx. 100 mL; 1 mL/kg ≈ +1 mEq/L (p. 538)', () => {
  assert.deepEqual(bolusNaCl3Ml(20), { ml: 40, noMaximo: false })
  assert.deepEqual(bolusNaCl3Ml(50), { ml: 100, noMaximo: false })
  assert.deepEqual(bolusNaCl3Ml(60), { ml: 100, noMaximo: true })
  assert.equal(elevacaoNaCl3(20, 40), 2)
  assert.deepEqual(LIMITES_CORRECAO_HIPO.baixoRisco24h, [8, 10])
  assert.equal(LIMITES_CORRECAO_HIPO.baixoRisco48h, 18)
  assert.deepEqual(LIMITES_CORRECAO_HIPO.altoRisco24h, [6, 8])
})

test('Tabela 3: variação por litro = (Na solução − Na paciente)/(0,6 × P + 1) (p. 540)', () => {
  // 20 kg, Na 120, NaCl 3% (500 mEq/L, Tabela 11): (500 − 120)/13 ≈ +29,2 por litro
  const porL = variacaoNaPorLitro(120, naSol('nacl3'), 20)!
  assert.equal(r1(porL), 29.2)
  assert.equal(Math.round(litrosParaVariacao(8, porL)! * 1000), 274) // ~274 mL para +8
  // hipernatremia: 20 kg, Na 160, SG 5%: −160/13 ≈ −12,3 por litro
  const sg = variacaoNaPorLitro(160, naSol('sg5'), 20)!
  assert.equal(r1(sg), -12.3)
  assert.equal(litrosParaVariacao(8, sg), null) // sinais opostos
  assert.equal(r1(litrosParaVariacao(-10, sg)), 0.8)
})

test('hipernatremia: queda ≤ 0,5 mEq/L/h; SG 5% 3 mL/kg; déficit de água livre da Tabela 6 (p. 542–543)', () => {
  assert.equal(horasMinimasHiper(160, 150), 20)
  assert.equal(horasMinimasHiper(150, 160), null)
  assert.equal(sg5RapidoMl(15), 45)
  // 20 kg, Na 160 → desejado 150: 20 × 0,6 × (160/150 − 1) = 0,8 L
  assert.equal(r1(deficitAguaLivrePed(20, 160, 150)), 0.8)
  assert.equal(deficitAguaLivrePed(0, 160, 150), null)
})
