// node --experimental-strip-types --test src/clinico/pediatria/rcp.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDose } from './fonteP2.ts'
import { COREIA_PALS_2025 } from '../fontesPubmed.ts'
import { DROGAS_RCP, NOTAS_CHOQUE, cargasPorPeso, fichaRcpPediatrica, parametrosRcp } from './rcp.ts'

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

test('rcp: cargas 2 → 4 → 4–10 J/kg e cardioversão 0,5–1 → 2 J/kg (p. 35, 51; 2ª tentativa pela AHA 2025, lote D11)', () => {
  const c = cargasPorPeso(20)!
  assert.equal(c.primeiro, 40)
  assert.equal(c.segundo, 80)
  assert.deepEqual(c.subsequentes, [80, 200])
  assert.deepEqual(c.cardioversaoInicial, [10, 20])
  assert.deepEqual(c.cardioversaoSeguinte, [40, 40])
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

// ── AHA 2025, Part 8 no texto integral (lacunas da Central, lote 3) ──

test('RCP pediátrica: ficha .2 com o Part 8 completo', () => {
  assert.equal(fichaRcpPediatrica.versao, '2026-11-19.1') // lote D11 (19/11/2026)
  assert.match(fichaRcpPediatrica.fontes[1].citacao, /Topjian AA.*S479–S537/)
})
test('RCP pediátrica: epinefrina 0,01 mg/kg com teto de 1 mg (AHA 2025, Figura 2)', () => {
  const epi = d('epinefrina-iv')
  assert.equal(calcularDose(epi, 20)!.dose[0], 0.2)
  assert.equal(calcularDose(epi, 120)!.dose[1], 1)
})

// ── Lote D11 (decisão do RT de 19/11/2026): itens 1, 4, 5 e 6 ──

test('lote D11: atropina máx. 0,5 mg; cloreto de cálcio até 20 mL; magnésio até 2 g; cardioversão 2 J/kg', () => {
  assert.equal(fichaRcpPediatrica.versao, '2026-11-19.1')
  assert.ok(fichaRcpPediatrica.fontes.includes(COREIA_PALS_2025))
  assert.match(fichaRcpPediatrica.revisadoEm, /^19\/11\/2026 \(lote D11: itens 1, 4, 5 e 6/)
  // item 1: atropina 0,02 mg/kg, máx. 0,5 mg (o livro não tinha máximo)
  const at = calcularDose(d('atropina'), 40)!
  assert.deepEqual(at.dose, [0.5, 0.5])
  assert.equal(at.noMaximo, true)
  assert.match(d('atropina').nota!, /sem máximo \(p\. 32\).*0,5 mg/)
  // item 4: cloreto de cálcio 10% 0,2 mL/kg, teto de 20 mL (2 g)
  assert.deepEqual(calcularDose(d('cloreto-calcio'), 150)!.dose, [20, 20])
  assert.match(d('cloreto-calcio').nota!, /Coreia 2025/)
  // item 5: magnésio 25–50 mg/kg, teto de 2 g
  const mg = calcularDose(d('magnesio'), 60)!
  assert.deepEqual(mg.dose, [1500, 2000])
  assert.deepEqual(mg.volumeMl, [3, 4])
  // item 6: 2ª tentativa da cardioversão = 2 J/kg; o livro (1 a 2 J/kg) fica no texto
  assert.deepEqual(cargasPorPeso(15)!.cardioversaoSeguinte, [30, 30])
  assert.match(NOTAS_CHOQUE.find((n) => /TSV/.test(n.texto))!.texto, /se persistir, 2 J\/kg.*o livro dá 1 a 2 J\/kg/)
})
