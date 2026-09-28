import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ALVOS_PA_AVC, ERRATA_PA_AVC, ITENS_NIHSS, SANGRAMENTO_POS_ALTEPLASE, alteplaseAvc, avaliarTrombolise, conferirPa, cortesNihss,
  fichaNihssAdulto, fichaRankinAdulto, fichaTromboliseAvcAdulto, nihss, nitroprussiatoMlH, rankin, reducao15, tenecteplaseAvc,
  tranexamicoPosAlteplase,
} from './avcTrombolise.ts'

const r2 = (x: number) => Math.round(x * 100) / 100

test('AVC: fichas de adulto do manual do HC, sem referência pediátrica', () => {
  for (const f of [fichaTromboliseAvcAdulto, fichaNihssAdulto, fichaRankinAdulto]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência.*cap\. 38/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
  for (const a of ALVOS_PA_AVC) assert.match(a.pagina, /^p\. \d+/)
})

test('alteplase no AVC: 0,9 mg/kg, máximo 90 mg, 10% em bolus e o resto em 60 min (Tabela 5, p. 526)', () => {
  const r = alteplaseAvc(70)!
  assert.deepEqual([r2(r.totalMg), r2(r.bolusMg), r2(r.infusaoMg), r2(r.infusaoMgH), r.limitadoAoTeto], [63, 6.3, 56.7, 56.7, false])
  const p = alteplaseAvc(110)! // 99 → 90
  assert.deepEqual([p.totalMg, r2(p.bolusMg), r2(p.infusaoMg), p.limitadoAoTeto], [90, 9, 81, true])
  assert.equal(alteplaseAvc(100)!.limitadoAoTeto, false) // 90 exatos
  assert.equal(alteplaseAvc(0), null)
})

test('tenecteplase no AVC: 0,4 mg/kg em bolus, sem teto no livro (p. 521)', () => {
  assert.equal(r2(tenecteplaseAvc(70)!), 28)
  assert.equal(r2(tenecteplaseAvc(150)!), 60)
  assert.equal(tenecteplaseAvc(-1), null)
})

test('Tabela 4: janelas < 3 h e 3–4,5 h com NIHSS ≤ 25; ≥ 4,5 h fora (p. 521)', () => {
  const base = { idadeAnos: 60, plaquetas: 200000, pas: 170, pad: 90, glicemia: 120 }
  assert.deepEqual(avaliarTrombolise({ ...base, horas: 2 }).indicacao, ['Idade 60 anos (critério do livro: ≥ 18 anos)', '< 3 h da última vez assintomático'])
  assert.ok(avaliarTrombolise({ ...base, horas: 4, nihss: 25 }).indicacao.includes('Entre 3 e 4,5 h com NIHSS ≤ 25'))
  assert.equal(avaliarTrombolise({ ...base, horas: 4, nihss: 26 }).foraDaIndicacao.length, 1)
  assert.equal(avaliarTrombolise({ ...base, horas: 4.5 }).foraDaIndicacao.length, 1)
  assert.ok(avaliarTrombolise({ ...base, horas: 4 }).faltando[0].startsWith('NIHSS'))
  assert.equal(avaliarTrombolise({ ...base, idadeAnos: 17, horas: 1 }).foraDaIndicacao.length, 1)
})

test('Tabela 4: contraindicações numéricas (plaquetas < 100.000, INR > 1,7, TTPa > 40, TP > 15, PA ≥ 185 × 110)', () => {
  const r = avaliarTrombolise({ idadeAnos: 60, horas: 1, plaquetas: 99000, inr: 1.8, ttpaS: 41, tpS: 16, pas: 185, pad: 100, glicemia: 100 })
  assert.equal(r.absolutas.length, 5)
  const limite = avaliarTrombolise({ idadeAnos: 60, horas: 1, plaquetas: 100000, inr: 1.7, ttpaS: 40, tpS: 15, pas: 184, pad: 109, glicemia: 100 })
  assert.deepEqual(limite.absolutas, [])
  assert.equal(avaliarTrombolise({ idadeAnos: 60, horas: 1, plaquetas: 150000, pas: 150, pad: 110, glicemia: 100 }).absolutas.length, 1)
})

test('Tabela 4: situações de risco-benefício (glicemia < 50 ou > 400, NIHSS ≤ 5, Rankin ≥ 2, > 80 anos entre 3 e 4,5 h)', () => {
  const r = avaliarTrombolise({ idadeAnos: 81, horas: 3.5, nihss: 4, plaquetas: 200000, pas: 150, pad: 80, glicemia: 401, rankinPrevio: 2, varfarina: true, inr: 1.5, avcPrevioEDiabetes: true })
  assert.equal(r.ponderar.length, 6)
  assert.deepEqual(avaliarTrombolise({ idadeAnos: 60, horas: 1, plaquetas: 200000, pas: 150, pad: 80, glicemia: 50 }).ponderar, [])
})

test('PA no AVC: errata da inversão (p. 518–519) e cortes das p. 522, 526 e 537', () => {
  assert.match(ERRATA_PA_AVC, /inverte/)
  assert.deepEqual(conferirPa('pos-trombolise', 179, 104)!.acimaDoCorte, false)
  assert.deepEqual(conferirPa('pos-trombolise', 180, 90)!.acimaDoCorte, true)
  assert.deepEqual(conferirPa('pre-trombolise', 184, 110)!.acimaDoCorte, true)
  assert.deepEqual(conferirPa('sem-trombolise', 219, 119)!.acimaDoCorte, false)
  assert.deepEqual(conferirPa('sem-trombolise', 200, 120)!.acimaDoCorte, true)
  const alvo = reducao15(220, 120)!
  assert.deepEqual([r2(alvo.pas), r2(alvo.pad)], [187, 102])
})

test('nitroprussiato: 50 mg em 250 mL = 200 µg/mL; 0,25 µg/kg/min (Tabela 3, p. 519)', () => {
  assert.equal(r2(nitroprussiatoMlH(80)!), 6)
  assert.equal(r2(nitroprussiatoMlH(80, 1)!), 24)
  assert.equal(nitroprussiatoMlH(0), null)
})

test('sangramento pós-alteplase: crio 10 U, fibrinogênio 200, TXA 10–15 mg/kg (Tabela 6, p. 528)', () => {
  assert.deepEqual([SANGRAMENTO_POS_ALTEPLASE.crioUnidades, SANGRAMENTO_POS_ALTEPLASE.fibrinogenioAlvo], [10, 200])
  assert.deepEqual(tranexamicoPosAlteplase(70), [700, 1050])
  assert.match(SANGRAMENTO_POS_ALTEPLASE.errata, /UI/)
})

test('NIHSS: 15 itens da Tabela 2, máximo 42, não testável entra com 0 e alerta', () => {
  assert.equal(ITENS_NIHSS.length, 15)
  const max: Record<string, number> = {}
  for (const i of ITENS_NIHSS) if (i.tipo === 'escolha') max[i.id] = i.opcoes.findIndex((o) => o.valor === Math.max(...i.opcoes.map((x) => x.valor)))
  assert.equal(nihss.calcular(max)!.valor, '42')
  const zeros = Object.fromEntries(ITENS_NIHSS.map((i) => [i.id, 0]))
  assert.equal(nihss.calcular(zeros)!.valor, '0')
  const nt = nihss.calcular({ ...zeros, '10': 3, '5a': 5 })!
  assert.equal(nt.valor, '0')
  assert.match(nt.alerta!, /5a.*10/)
  assert.equal(nihss.calcular({ '1a': 0 }), null)
})

test('NIHSS: cortes do capítulo', () => {
  assert.equal(cortesNihss(3).length, 3)
  assert.ok(cortesNihss(26).some((c) => c.startsWith('> 25')))
  assert.ok(cortesNihss(16).some((c) => c.startsWith('> 15')))
})

test('Rankin: 0 a 6 (Tabela 12, p. 536–537) e cortes', () => {
  assert.equal(rankin.calcular({}), null)
  assert.equal(rankin.calcular({ grau: 6 })!.valor, '6')
  assert.equal(rankin.calcular({ grau: 0 })!.nota, 'assintomático')
  assert.match(rankin.calcular({ grau: 3 })!.derivados[0][1], /≥ 3 prévio/)
})
