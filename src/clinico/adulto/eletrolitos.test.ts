import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  BOLUS_CALCIO, ESQUEMAS_MG, INFUSAO_CALCIO, TABELA7_HIPERCALCEMIA, calcioCorrigido, calcioElementar, calcularKEV, capsulasCloretoMg,
  classificarFosforo, classificarHipocalemia, classificarMagnesio, comprimidosCarbonato, comprimidosFosfato, deficitPotassio, esquemaHipocalemia,
  faixaReposicaoMgEstavel, fichaHipercalcemia, fichaReposicaoCalcio, fichaReposicaoFosforo, fichaReposicaoMagnesio, fichaReposicaoPotassio,
  fosforoMmolL, fracaoExcrecaoCalcio, infusaoCalcioDose, infusaoCalcioMlH, infusaoMagnesio, interpretarKUrinario, lerCalcioTotal, magnesioUnidades,
  quantidadeKVO, reposicaoFosforoIV, sulfatoMagnesio, tratamentoHipercalcemia, velocidadeBolus,
} from './eletrolitos.ts'

const r1 = (x: number | null | undefined) => Math.round(x! * 10) / 10
const r2 = (x: number | null | undefined) => Math.round(x! * 100) / 100

test('eletrólitos: fichas são de adulto, do manual do HC, ids adulto-*', () => {
  for (const f of [fichaReposicaoPotassio, fichaReposicaoMagnesio, fichaReposicaoCalcio, fichaHipercalcemia, fichaReposicaoFosforo]) {
    assert.match(f.id, /^adulto-/)
    assert.equal(f.publico, 'adulto')
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência/)
    assert.match(f.fontes[0].citacao, /p\. \d/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('potássio: classificação da p. 900 (leve 3–3,4; moderada 2,5–2,9; grave < 2,5)', () => {
  assert.equal(classificarHipocalemia(3.4), 'leve')
  assert.equal(classificarHipocalemia(3), 'leve')
  assert.equal(classificarHipocalemia(2.9), 'moderada')
  assert.equal(classificarHipocalemia(2.5), 'moderada')
  assert.equal(classificarHipocalemia(2.4), 'grave')
  assert.equal(classificarHipocalemia(3.5), 'sem hipocalemia')
  assert.equal(classificarHipocalemia(Number.NaN), null)
})

test('potássio: esquema do Anexo 5 (p. 1498)', () => {
  assert.deepEqual(esquemaHipocalemia(3.2, { sintomatica: false, perdaUrinaria: false })!.voMEqDia, [20, 80])
  assert.equal(esquemaHipocalemia(3.2, { sintomatica: false, perdaUrinaria: false })!.ev, null)
  const mod = esquemaHipocalemia(2.8, { sintomatica: false, perdaUrinaria: false })!
  assert.deepEqual(mod.voMEqDia, [120, 160]) // 40 mEq 3–4x
  assert.deepEqual(mod.ev, { mEq: 20, horas: [2, 3] })
  assert.deepEqual(esquemaHipocalemia(3.3, { sintomatica: true, perdaUrinaria: false })!.ev, { mEq: 20, horas: [2, 3] })
  assert.equal(esquemaHipocalemia(3.3, { sintomatica: false, perdaUrinaria: true })!.voMEqDia, null)
  assert.equal(esquemaHipocalemia(3.6, { sintomatica: false, perdaUrinaria: false }), null)
})

test('potássio: apresentações da Tab. 4 (p. 907) convertem de volta ao livro', () => {
  assert.equal(r1(calcularKEV({ mEq: 13.4, apresentacao: 'kcl-10', diluenteMl: 100, horas: 1 })!.volumeKClMl), 10)
  assert.equal(calcularKEV({ mEq: 25, apresentacao: 'kcl-191', diluenteMl: 100, horas: 1 })!.volumeKClMl, 10)
  assert.equal(r1(quantidadeKVO(12, 'xarope-6')), 15)
  assert.equal(quantidadeKVO(40, 'capsula-600'), 5)
  assert.equal(quantidadeKVO(0, 'capsula-600'), null)
})

test('potássio EV: 20 mEq em 2 h do anexo cabe nos limites; conta de volume, ampolas e concentração', () => {
  const r = calcularKEV({ mEq: 20, apresentacao: 'kcl-191', diluenteMl: 492, horas: 2 })!
  assert.equal(r.volumeKClMl, 8)
  assert.equal(r.ampolas, 1)
  assert.equal(r.volumeTotalMl, 500)
  assert.equal(r.concentracaoMEqL, 40) // dentro de 20–60 mEq/L
  assert.equal(r.mEqH, 10)
  assert.equal(r.mlH, 250)
  assert.equal(r.alertas.length, 0)
  const k10 = calcularKEV({ mEq: 20, apresentacao: 'kcl-10', diluenteMl: 500, horas: 2 })!
  assert.equal(r1(k10.volumeKClMl), 14.9)
  assert.equal(k10.ampolas, 2)
})

test('potássio EV: alertas de velocidade (10/20/40 mEq/h) e concentração (20–60 mEq/L)', () => {
  const rapido = calcularKEV({ mEq: 20, apresentacao: 'kcl-191', diluenteMl: 100, horas: 0.5 })! // 40 mEq/h, 185 mEq/L
  assert.ok(rapido.alertas.some((a) => /10–20 mEq\/h/.test(a)))
  assert.ok(rapido.alertas.some((a) => /flebite/.test(a)))
  assert.ok(rapido.alertas.some((a) => /acima de 20–60/.test(a)))
  const muito = calcularKEV({ mEq: 50, apresentacao: 'kcl-191', diluenteMl: 1000, horas: 1 })!
  assert.ok(muito.alertas.some((a) => /Acima de 40 mEq\/h/.test(a)))
  assert.equal(calcularKEV({ mEq: 20, apresentacao: 'kcl-191', diluenteMl: 500, horas: 0 }), null)
})

test('potássio: déficit 200–400 mEq por 1 mEq/L de queda (p. 905)', () => {
  assert.deepEqual(deficitPotassio(1), [200, 400])
  assert.deepEqual(deficitPotassio(1.5), [300, 600])
  assert.equal(deficitPotassio(-1), null)
})

test('potássio: excreção urinária (Tab. 2, p. 903; Fig. 1, p. 906) com a errata da p. 904', () => {
  assert.match(interpretarKUrinario({ k24h: 40 })[0].texto, /perda urinária/)
  assert.match(interpretarKUrinario({ k24h: 20 })[0].texto, /extrarrenal/)
  assert.match(interpretarKUrinario({ k24h: 28 })[0].texto, /entre os cortes/)
  const alto = interpretarKUrinario({ kCrSpot: 20, naU: 40, osmU: 500, osmP: 290 })[0]
  assert.match(alto.texto, /perda urinária/)
  assert.ok(alto.errata)
  assert.match(interpretarKUrinario({ kCrSpot: 8 })[0].texto, /extrarrenal.*informe/)
  assert.match(interpretarKUrinario({ kCrSpot: 20, naU: 20, osmU: 500, osmP: 290 })[0].texto, /não se cumpre/)
})

test('magnésio: conversões do Anexo 5 (p. 1501–1502)', () => {
  assert.deepEqual(sulfatoMagnesio(1), { ml10: 10, mEq: 8, mmol: 4 })
  assert.deepEqual(sulfatoMagnesio(4), { ml10: 40, mEq: 32, mmol: 16 }) // "4-8 g (32-64 mEq [16-32 mmol])"
  assert.deepEqual(sulfatoMagnesio(8), { ml10: 80, mEq: 64, mmol: 32 })
  // cortes em mg/dL e seus equivalentes que o livro escreve
  assert.equal(r1(magnesioUnidades(1)!.mmolL), 0.4)
  assert.equal(r1(magnesioUnidades(1)!.mEqL), 0.8)
  assert.equal(r1(magnesioUnidades(1.5)!.mmolL), 0.6)
  assert.equal(r1(magnesioUnidades(1.9)!.mmolL), 0.8)
})

test('magnésio: classificação e faixa EV do paciente estável', () => {
  assert.equal(classificarMagnesio(0.9), 'grave')
  assert.equal(classificarMagnesio(1), 'moderada')
  assert.equal(classificarMagnesio(1.5), 'moderada')
  assert.equal(classificarMagnesio(1.8), 'hipomagnesemia')
  assert.equal(classificarMagnesio(2), 'sem hipomagnesemia')
  assert.deepEqual(faixaReposicaoMgEstavel(0.8)!.gramas, [4, 8])
  assert.deepEqual(faixaReposicaoMgEstavel(0.8)!.horas, [12, 24])
  assert.deepEqual(faixaReposicaoMgEstavel(1.2)!.horas, [4, 12])
  assert.deepEqual(faixaReposicaoMgEstavel(1.7)!.gramas, [1, 2])
  assert.equal(faixaReposicaoMgEstavel(1.55), null) // entre as faixas do livro
  assert.equal(faixaReposicaoMgEstavel(1.95), null)
})

test('magnésio: infusão, redução de 50% com ClCr < 30, errata de 12–25 h e cápsulas VO', () => {
  const m = infusaoMagnesio({ gramas: 2, diluenteMl: 100, minutos: 30 })!
  assert.equal(m.volumeTotalMl, 120)
  assert.equal(m.mlH, 240)
  const drc = infusaoMagnesio({ gramas: 8, diluenteMl: 500, minutos: 24 * 60, clcrMenor30: true })!
  assert.equal(drc.gramas, 4)
  assert.equal(r1(drc.mlH), 22.5)
  const man = ESQUEMAS_MG.find((e) => e.id === 'manutencao')!
  assert.deepEqual(man.minutos, [720, 1440])
  assert.match(man.errata!, /12-25/)
  const [a, b] = capsulasCloretoMg(286)!
  assert.equal(a, 4)
  assert.equal(r1(b), 4.5)
})

test('cálcio: corrigido pela albumina (p. 919) e cortes', () => {
  assert.equal(r1(calcioCorrigido(7.6, 2)), 9.2)
  assert.equal(calcioCorrigido(9, 4), 9)
  assert.equal(r1(calcioCorrigido(10, 5)), 9.2)
  assert.equal(calcioCorrigido(0, 3), null)
  assert.equal(lerCalcioTotal(8.4)!.faixa, 'hipocalcemia')
  assert.match(lerCalcioTotal(6.5)!.referencias[1].texto, /sintomática/)
  assert.match(lerCalcioTotal(7.2)!.referencias[1].texto, /7–7,5/)
  assert.equal(lerCalcioTotal(9.5)!.faixa, 'normal')
  assert.match(lerCalcioTotal(12.5)!.referencias[1].texto, /moderada/)
  assert.match(lerCalcioTotal(14.5)!.referencias[1].texto, /grave/)
  assert.match(lerCalcioTotal(11)!.referencias[1].texto, /fora dos cortes/)
})

test('cálcio: Ca elementar e mEq das soluções a 10% (p. 916, 922, 1500)', () => {
  assert.deepEqual(calcioElementar('gluconato', 10), { mgCa: 90, mEq: 4.6 }) // Tab. 4: 90 mg/10 mL
  assert.deepEqual(calcioElementar('cloreto', 10), { mgCa: 270, mEq: 13.6 }) // Tab. 4: 270 mg/10 mL
  assert.equal(calcioElementar('gluconato', 20)!.mgCa, 180)
  assert.equal(velocidadeBolus(20, 100, 10), 720)
  assert.equal(velocidadeBolus(10, 100, 20), 330)
  for (const b of BOLUS_CALCIO) assert.ok(b.errata)
})

test('cálcio: infusão contínua 110 mL + 890 mL (≈ 1 mg/mL), 50 mL/h de início, 0,5–1,5 mg/kg/h', () => {
  assert.equal(INFUSAO_CALCIO.concentracaoMgMl, 0.99)
  assert.equal(r1(infusaoCalcioDose(50, 70)), 0.7) // 50 mL/h em 70 kg ≈ 0,71 mg/kg/h, dentro da faixa
  assert.equal(r1(infusaoCalcioMlH(1, 70)), 70.7)
  assert.equal(r1(infusaoCalcioMlH(0.5, 99)), 50)
  assert.equal(infusaoCalcioMlH(1, 0), null)
})

test('cálcio VO: carbonato 1.250 mg = 500 mg de Ca elementar (p. 923)', () => {
  assert.equal(comprimidosCarbonato(1500), 3)
  assert.equal(comprimidosCarbonato(2000), 4)
})

test('hipercalcemia: FECa (p. 925), Tab. 7 por peso e errata do SF', () => {
  assert.equal(r2(fracaoExcrecaoCalcio({ caU: 5, fluxoMlMin: 1, caP: 12, tfgMlMin: 100 })), 0)
  assert.equal(fracaoExcrecaoCalcio({ caU: 5, fluxoMlMin: 1, caP: 12, tfgMlMin: 100 })! < 0.01, true)
  assert.equal(r2(fracaoExcrecaoCalcio({ caU: 24, fluxoMlMin: 1, caP: 12, tfgMlMin: 100 })), 0.02)
  assert.equal(fracaoExcrecaoCalcio({ caU: 5, fluxoMlMin: 1, caP: 0, tfgMlMin: 100 }), null)
  const t = tratamentoHipercalcemia(70)
  assert.equal(t.prednisonaMg, 70)
  assert.deepEqual(t.calcitoninaUI, [280, 560])
  assert.deepEqual(t.pamidronatoMlH, [62.5, 125])
  assert.equal(tratamentoHipercalcemia(0).prednisonaMg, null)
  assert.ok(TABELA7_HIPERCALCEMIA[0].errata)
})

test('fósforo: equivalências do anexo (p. 1501)', () => {
  assert.equal(r1(fosforoMmolL(2.5)), 0.8)
  assert.equal(r2(fosforoMmolL(1)), 0.32)
  assert.equal(r2(fosforoMmolL(1.5)), 0.48)
  assert.equal(r2(fosforoMmolL(2)), 0.65)
  assert.equal(classificarFosforo(0.9), 'grave')
  assert.equal(classificarFosforo(1), 'moderada')
  assert.equal(classificarFosforo(2), 'moderada')
  assert.equal(classificarFosforo(2.3), 'hipofosfatemia')
  assert.equal(classificarFosforo(2.5), 'sem hipofosfatemia')
  assert.equal(comprimidosFosfato(32), 4)
})

test('fósforo IV: dose por kg com teto, volume, cátion e limite de 7,5 mmol/h', () => {
  const g = reposicaoFosforoIV({ esquema: 'grave-critico', pesoKg: 70, mmolKg: 0.5, horas: 8, sal: 'potassio' })!
  assert.equal(g.mmol, 35)
  assert.equal(r1(g.ml), 11.7)
  assert.equal(r1(g.mEqCation), 51.3)
  assert.equal(g.cation, 'K')
  assert.equal(r2(g.mmolH), 4.38)
  assert.equal(g.alertas.length, 0)
  const teto = reposicaoFosforoIV({ esquema: 'grave-critico', pesoKg: 200, mmolKg: 0.5, horas: 8, sal: 'sodio' })!
  assert.equal(teto.mmol, 80)
  assert.equal(r1(teto.mEqCation), 106.7)
  assert.ok(teto.alertas.some((a) => /máximo de 80/.test(a)))
  assert.ok(teto.alertas.some((a) => /7,5 mmol/.test(a))) // 80 mmol em 8 h = 10 mmol/h
  const vm = reposicaoFosforoIV({ esquema: 'moderada-vm', pesoKg: 150, mmolKg: 0.24, horas: 6, sal: 'sodio' })!
  assert.equal(vm.mmol, 30)
  assert.equal(reposicaoFosforoIV({ esquema: 'moderada-vm', pesoKg: 0, mmolKg: 0.1, horas: 6, sal: 'sodio' }), null)
})
