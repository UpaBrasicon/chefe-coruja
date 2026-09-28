// node --experimental-strip-types --test src/clinico/pediatria/rcp.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDose } from './fonteP2.ts'
import { DROGAS_RCP, cargasPorPeso, fichaRcpPediatrica, parametrosRcp } from './rcp.ts'

const d = (id: string) => DROGAS_RCP.find((x) => x.id === id)!
const r2 = (x: number) => Math.round(x * 100) / 100

test('rcp: ficha pediátrica do livro do ICr, com página', () => {
  assert.equal(temReferenciaPediatrica(fichaRcpPediatrica), true)
  assert.match(fichaRcpPediatrica.fontes[0].citacao, /ICr-HCFMUSP.*p\. 24–38/)
  for (const x of DROGAS_RCP) assert.ok(x.pagina, x.id)
  assert.equal(new Set(DROGAS_RCP.map((x) => x.id)).size, DROGAS_RCP.length)
})

test('rcp: parâmetros da Tabela 1 (p. 30–31)', () => {
  assert.match(parametrosRcp('lactente').profundidade, /4 cm/)
  assert.match(parametrosRcp('crianca').profundidade, /5 cm/)
  assert.match(parametrosRcp('adolescente').profundidade, /5 a 6 cm/)
  assert.match(parametrosRcp('crianca').relacao, /30:2.*15:2/)
  assert.match(parametrosRcp('lactente').frequencia, /100 a 120/)
  assert.match(parametrosRcp('lactente').viaAereaAvancada, /2 a 3 segundos \(20 a 30\/min\)/)
})

test('rcp: cargas 2 → 4 → 4–10 J/kg e cardioversão 0,5–1 → 1–2 J/kg (p. 35, 51)', () => {
  const c = cargasPorPeso(20)!
  assert.equal(c.primeiro, 40)
  assert.equal(c.segundo, 80)
  assert.deepEqual(c.subsequentes, [80, 200])
  assert.equal(c.acimaDoAdulto, false)
  assert.deepEqual(c.cardioversaoInicial, [10, 20])
  assert.deepEqual(c.cardioversaoSeguinte, [20, 40])
  assert.equal(cargasPorPeso(25)!.acimaDoAdulto, true) // 250 J > 200 J bifásico
  assert.equal(cargasPorPeso(0), null)
})

test('rcp: Tabela 2 (p. 31–32) a 10 kg', () => {
  const epi = calcularDose(d('epinefrina-iv'), 10)!
  assert.deepEqual(epi.dose, [0.1, 0.1])
  assert.deepEqual(epi.volumeMl, [1, 1]) // 0,1 mL/kg de 1:10.000
  assert.deepEqual(calcularDose(d('epinefrina-et'), 10)!.volumeMl, [1, 1]) // 0,1 mL/kg de 1:1.000
  assert.deepEqual(calcularDose(d('bicarbonato'), 10)!.volumeMl, [10, 10])
  assert.deepEqual(calcularDose(d('calcio'), 10)!.dose, [50, 70])
  assert.deepEqual(calcularDose(d('cloreto-calcio'), 10)!.dose, [2, 2])
  assert.deepEqual(calcularDose(d('gluconato-calcio'), 10)!.dose, [6, 6])
  const mg = calcularDose(d('magnesio'), 10)!
  assert.deepEqual(mg.dose, [250, 500])
  assert.deepEqual(mg.volumeMl, [0.5, 1]) // 500 mg/mL
  const gli = calcularDose(d('glicose'), 10)!
  assert.deepEqual(gli.dose, [5, 10])
  assert.deepEqual(gli.volumeMl, [20, 40]) // 2–4 mL/kg de G25%
  assert.deepEqual(calcularDose(d('lidocaina-et'), 10)!.dose, [20, 30])
})

test('rcp: máximos — amiodarona 300 mg; adenosina 6 e 12 mg (p. 32, 50)', () => {
  assert.deepEqual(calcularDose(d('amiodarona'), 20)!.dose, [100, 100])
  const a = calcularDose(d('amiodarona'), 70)!
  assert.deepEqual(a.dose, [300, 300])
  assert.equal(a.noMaximo, true)
  assert.deepEqual(calcularDose(d('adenosina-1'), 30)!.dose, [3, 3])
  assert.deepEqual(calcularDose(d('adenosina-1'), 80)!.dose, [6, 6])
  assert.deepEqual(calcularDose(d('adenosina-2'), 80)!.dose, [12, 12])
  assert.equal(r2(calcularDose(d('atropina'), 15)!.dose[0]), 0.3)
})
