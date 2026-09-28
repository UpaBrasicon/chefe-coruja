import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  BCC, BETABLOQUEADOR, BICARBONATO_USOS, CARVAO_INDICACAO, CIANETO, NAC, NALOXONA, ALCOOIS,
  acidoFolicoMg, atropinaDobrando, bccFigura, bicarbonatoBolus, calcioBccManutencao, carvaoMultiplasDoses, carvaoPorMassaIngerida,
  carvaoPorPeso, carvaoTriciclico, etanolEV, fichaIntoxicacoesAdulto, flumazenilBolusMaximos, fomepizol, frascosPorDose,
  frascosPorNivel, gravidadeParacetamol, hidroxocobalaminaProxima, indicacoesNac, insulinaAltaDose, nacEV, nacVO,
  nitritoSodioMg, pralidoxima, tiossulfatoAdultoMl,
} from './intoxicacoes.ts'

const r2 = (x: number) => Math.round(x * 100) / 100
const uso = (id: string) => BICARBONATO_USOS.find((u) => u.id === id)!

test('intoxicações: ficha adulto, manual do HC, id kebab, sem referência pediátrica', () => {
  assert.equal(fichaIntoxicacoesAdulto.publico, 'adulto')
  assert.match(fichaIntoxicacoesAdulto.id, /^adulto-[a-z0-9-]+$/)
  assert.match(fichaIntoxicacoesAdulto.fontes[0].citacao, /Manual de Medicina de Emergência.*p\. 1299–1337/)
  assert.equal(temReferenciaPediatrica(fichaIntoxicacoesAdulto), false)
  for (const i of [...CARVAO_INDICACAO, ...BICARBONATO_USOS, ...ALCOOIS.outros]) assert.match(i.pagina, /p\. \d+/, i.id)
})

test('carvão: 10 g por g ingerido; 1 g/kg (25–100 g) sem dose conhecida (p. 1300)', () => {
  assert.equal(carvaoPorMassaIngerida(3), 30)
  assert.deepEqual(carvaoPorPeso(70), { g: 70, foraDaFaixa: false })
  assert.deepEqual(carvaoPorPeso(120), { g: 120, foraDaFaixa: true })
  assert.equal(carvaoPorMassaIngerida(0), null)
})

test('carvão: tricíclico 1 g/kg máx. 50 g (p. 1308); múltiplas doses 12,5 g/h a cada 2–4 h (p. 1302)', () => {
  assert.deepEqual(carvaoTriciclico(45), { g: 45, limitadoAoTeto: false })
  assert.deepEqual(carvaoTriciclico(80), { g: 50, limitadoAoTeto: true })
  assert.equal(carvaoMultiplasDoses(2), 25) // "25 g a cada 2 horas" (p. 1301)
  assert.equal(carvaoMultiplasDoses(4), 50) // "50 g a cada 4 horas"
  assert.equal(carvaoMultiplasDoses(6), null)
  assert.ok(CARVAO_INDICACAO.find((c) => c.id === 'multiplas')!.errata)
})

test('paracetamol: faixas de gravidade em gramas (p. 1310)', () => {
  assert.match(gravidadeParacetamol(5)!.rotulo, /^< 7,5/)
  assert.match(gravidadeParacetamol(7.5)!.rotulo, /^7,5–12/)
  assert.match(gravidadeParacetamol(12)!.rotulo, /^7,5–12/)
  assert.match(gravidadeParacetamol(13)!.rotulo, /^> 12/)
  assert.match(gravidadeParacetamol(20)!.rotulo, /^> 15/)
})

test('NAC: indicações listadas (p. 1311), sem calcular o nomograma', () => {
  const base = { nivelDisponivel: true, tempoDesconhecido: false, acimaDaLinhaNomograma: false, hepatotoxicidade: false }
  assert.deepEqual(indicacoesNac(base), [])
  assert.equal(indicacoesNac({ ...base, nivelDisponivel: false, gramasIngeridos: 8 }).length, 1)
  assert.equal(indicacoesNac({ ...base, nivelDisponivel: false, gramasIngeridos: 7.5 }).length, 0) // "> 7,5 g"
  assert.equal(indicacoesNac({ ...base, tempoDesconhecido: true, nivelUgMl: 12 }).length, 1)
  assert.equal(indicacoesNac({ ...base, acimaDaLinhaNomograma: true, hepatotoxicidade: true }).length, 2)
})

test('NAC VO 140 + 70 mg/kg 4/4 h, ≈ 17 doses (p. 1311)', () => {
  assert.deepEqual(nacVO(70), { ataqueMg: 9800, manutencaoMg: 4900, doses: 17 })
})

test('NAC EV: 150 mg/kg em 1 h, 50 mg/kg em 4 h, 100 mg/kg em 16 h (p. 1311) e errata do 6,25 mg/kg/h', () => {
  const r = nacEV(70)!
  assert.deepEqual(r.fases.map((f) => f.mg), [10500, 3500, 7000])
  assert.deepEqual(r.fases.map((f) => f.mgKgH), [150, 12.5, 6.25])
  assert.deepEqual(r.fases.map((f) => f.mgH), [10500, 875, 437.5])
  assert.deepEqual([r.totalMgKg, r.totalMg], [300, 21000])
  assert.match(NAC.ev.errata, /6,25 mg\/kg\/h/)
  assert.equal(nacEV(0), null)
})

test('flumazenil 0,2 mg até 1 mg (p. 1314) e naloxona por cenário (p. 1316)', () => {
  assert.equal(flumazenilBolusMaximos(), 5)
  assert.deepEqual(NALOXONA.cenarios.map((c) => c.mg), [[0.04, 0.04], [0.2, 1], [2, 2]])
})

test('betabloqueador: insulina 1 UI/kg + 0,5 UI/kg/h, teto 10 UI/kg com errata (p. 1317)', () => {
  assert.deepEqual(insulinaAltaDose(80), { bolusUi: 80, infusaoUiH: 40, tetoUi: 800 })
  assert.match(BETABLOQUEADOR.insulina.errata, /unidade de tempo/)
  assert.deepEqual([BETABLOQUEADOR.glucagon.bolusMg, BETABLOQUEADOR.glucagon.infusaoMgH], [5, [2, 5]])
  assert.deepEqual([BETABLOQUEADOR.atropina.mg, BETABLOQUEADOR.atropina.dosesMax], [1, 3])
})

test('BCC: manutenção 0,6–1,2 mL/kg/h de gluconato 10% (p. 1318) e Figura 2 (p. 1321)', () => {
  assert.deepEqual(calcioBccManutencao(70)!.map(r2), [42, 84])
  const f = bccFigura(70)!
  assert.deepEqual(f.glucagonPorPesoMg.map(r2), [2.1, 3.5])
  assert.deepEqual([f.insulinaBolusUi, f.insulinaInfusaoUiH], [[35, 70], [35, 70]])
  assert.deepEqual([f.emulsaoBolusMl, f.emulsaoMlMin, f.emulsaoMlH], [105, 35, 2100])
  assert.ok(BCC.calcio.errata)
  assert.equal(BCC.divergencias.length, 4)
})

test('digoxina: 10 frascos empíricos; (mg × 0,8)/0,5; (ng/mL × kg)/100 (p. 1322)', () => {
  assert.equal(frascosPorDose(5), 8)
  assert.equal(frascosPorDose(2.5), 4)
  assert.equal(frascosPorNivel(8, 70), 5.6)
  assert.equal(frascosPorNivel(8, 0), null)
})

test('bicarbonato 8,4% (1 mEq/mL, p. 938): 1–2 mEq/kg e 1 mEq/kg na cocaína', () => {
  assert.deepEqual(bicarbonatoBolus(uso('triciclico'), 70), { mEq: [70, 140], ml: [70, 140] })
  assert.deepEqual(bicarbonatoBolus(uso('cocaina'), 70)!.mEq, [70, 70])
  assert.equal(bicarbonatoBolus(uso('salicilato'), -1), null)
})

test('álcoois: fomepizol 15 + 10 mg/kg 12/12 h por 48 h; etanol 10% 10 mL/kg + 1,2 mL/kg/h; folato 1 mg/kg (p. 1327–1328)', () => {
  assert.deepEqual(fomepizol(70), { ataqueMg: 1050, manutencaoMg: 700, dosesEm48h: 4, depoisMg: 1050 })
  assert.match(ALCOOIS.fomepizol.errata, /15 mg\/kg\/dia/)
  const e = etanolEV(70)!
  assert.deepEqual([e.ataqueMl, r2(e.infusaoMlH)], [700, 84])
  assert.equal(acidoFolicoMg(70), 70)
  assert.ok(ALCOOIS.etanolVO.errata)
})

test('organofosforado: atropina 2 mg dobrando; pralidoxima 30 mg/kg + 8 mg/kg/h (p. 1333–1334)', () => {
  assert.deepEqual(atropinaDobrando(2, 4), [{ dose: 2, acumulado: 2 }, { dose: 4, acumulado: 6 }, { dose: 8, acumulado: 14 }, { dose: 16, acumulado: 30 }])
  assert.deepEqual(atropinaDobrando(0, 3), [])
  assert.deepEqual(pralidoxima(70), { bolusMg: 2100, infusaoMgH: 560 })
})

test('cianeto: hidroxocobalamina 5 g até 10 g no total; tiossulfato 12,5 g = 50 mL a 25%; nitrito 3% 10 mL = 300 mg (p. 1337)', () => {
  assert.deepEqual(hidroxocobalaminaProxima(0), { doseG: 5, restanteDepoisG: 5 })
  assert.deepEqual(hidroxocobalaminaProxima(5), { doseG: 5, restanteDepoisG: 0 })
  assert.deepEqual(hidroxocobalaminaProxima(7.5), { doseG: 2.5, restanteDepoisG: 0 })
  assert.deepEqual(hidroxocobalaminaProxima(10), { doseG: 0, restanteDepoisG: 0 })
  assert.equal(tiossulfatoAdultoMl(), 50)
  assert.equal(nitritoSodioMg(), 300)
  assert.match(CIANETO.tiossulfato.errata, /1,65 mL\/kg/)
})
