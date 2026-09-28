import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  EXEMPLO_FIGURA2, PEEP_ALTO_ALVEOLI, PEEP_ALTO_LOVS, PEEP_BAIXO, berlim, complacenciaEstatica, conferirObstruido, conferirSdra,
  constanteTempo, criteriosObjetivosDesmame, cortesIndicacaoVm, drivingPressure, falhaTre, fichaDesmameAdulto, fichaMecanicaAdulto,
  fichaSdraAdulto, fichaVmAjusteAdulto, fichaVmObstruidoAdulto, marcosPf, mecanica, peepParaFio2, peepPorAutoPeep, relacaoIE, relacaoPF, resistencia,
  tabelaPeepDaClasse, tinsVcv, vcPorPeso, vtSdra,
} from './ventilacaoMecanica.ts'

const perto = (a: number | null | undefined, b: number, eps = 1e-9) => assert.ok(a !== null && a !== undefined && Math.abs(a - b) < eps, `${a} ≠ ${b}`)

test('VM: fichas adulto do cap. 37, sem referência pediátrica', () => {
  for (const f of [fichaVmAjusteAdulto, fichaVmObstruidoAdulto, fichaMecanicaAdulto, fichaSdraAdulto, fichaDesmameAdulto]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.match(f.fontes[0].citacao, /cap\. 37/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('mecânica: reproduz o exemplo da Figura 2 (p. 499)', () => {
  const e = EXEMPLO_FIGURA2
  perto(resistencia(e.ppico, e.pplato, e.fluxoLMin), e.rva)
  perto(complacenciaEstatica(e.vcMl, e.pplato, e.peep), e.cst)
  perto(drivingPressure(e.pplato, e.peep), 25)
  const tau = constanteTempo(e.rva, e.cst)!
  perto(tau.tauS, 0.2)
  perto(tau.esvaziamentoS[0], 0.6)
  perto(tau.esvaziamentoS[1], 1.0)
  const m = mecanica(e)
  assert.ok(m.notas.some((n) => /Resistência acima de 8/.test(n)))
  assert.ok(m.notas.some((n) => /Complacência estática abaixo de 50/.test(n)))
  assert.ok(m.notas.some((n) => /Driving pressure acima de 15/.test(n)))
})

test('mecânica: entradas inválidas', () => {
  assert.equal(resistencia(20, 30, 60), null)
  assert.equal(complacenciaEstatica(500, 5, 5), null)
  assert.equal(drivingPressure(0, 5), null)
  assert.equal(constanteTempo(0, 50), null)
})

test('ciclo: I:E pela FR e Tins; Tins do VCV com fluxo quadrado', () => {
  const r = relacaoIE(15, 1)!
  perto(r.cicloS, 4)
  perto(r.n, 3)
  assert.equal(relacaoIE(60, 1), null)
  perto(tinsVcv(500, 60), 0.5)
  assert.deepEqual(vcPorPeso(70, [6, 8]), [420, 560])
  assert.equal(vcPorPeso(0, [6, 8]), null)
})

test('indicação de VM (p. 498): PO2 < 60 e PCO2 > 55', () => {
  assert.equal(cortesIndicacaoVm({ po2: 60, pco2: 55 }).length, 0)
  assert.equal(cortesIndicacaoVm({ po2: 59, pco2: 56 }).length, 2)
})

test('obstruído grave (Tabela 4, p. 505): 85% da auto-PEEP e conferência', () => {
  perto(peepPorAutoPeep(10), 8.5)
  assert.equal(conferirObstruido({ fr: 10, tins: 1, fluxo: 60, pplato: 30, ppico: 45, ph: 7.25 }).length, 0)
  const a = conferirObstruido({ fr: 14, tins: 1.2, fluxo: 50, pplato: 31, ppico: 46, ph: 7.2 })
  assert.ok(a.some((x) => /FR fora/.test(x)))
  assert.ok(a.some((x) => /Tins acima/.test(x)))
  assert.ok(a.some((x) => /menor que 1:3/.test(x)))
  assert.ok(a.some((x) => /Fluxo abaixo/.test(x)))
  assert.ok(a.some((x) => /Pplatô/.test(x)))
  assert.ok(a.some((x) => /Ppico/.test(x)))
  assert.ok(a.some((x) => /pH ≤ 7,2/.test(x)))
  // FR 8 e Tins 1 → I:E 1:6,5, além de 1:5
  assert.ok(conferirObstruido({ fr: 8, tins: 1 }).some((x) => /além de 1:5/.test(x)))
})

test('Berlim (p. 505): faixas inteiras e PEEP ≥ 5', () => {
  assert.equal(berlim(300, 5)!.classe, 'leve')
  assert.equal(berlim(201, 5)!.classe, 'leve')
  assert.equal(berlim(200.5, 5)!.classe, null)
  assert.equal(berlim(200, 5)!.classe, 'moderada')
  assert.equal(berlim(101, 8)!.classe, 'moderada')
  assert.equal(berlim(100, 8)!.classe, 'grave')
  assert.equal(berlim(150, 4)!.classe, null)
  assert.equal(berlim(301, 5)!.classe, null)
  perto(relacaoPF(90, 60), 150)
  assert.equal(tabelaPeepDaClasse('grave'), 'alto')
  assert.equal(tabelaPeepDaClasse('moderada'), 'baixo')
  assert.deepEqual(vtSdra('leve', 60), [360, 360])
  assert.deepEqual(vtSdra('grave', 60), [240, 360]) // 4–6 mL/kg (errata da p. 506: 3–6)
})

test('tabelas PEEP × FiO2 (Tabelas 6 e 7, p. 506–507) como impressas', () => {
  assert.equal(PEEP_BAIXO.length, 14)
  assert.equal(PEEP_ALTO_ALVEOLI.length, 10)
  assert.equal(PEEP_ALTO_LOVS.length, 8)
  assert.deepEqual(peepParaFio2('baixo', 0.7)!.exatas.map((c) => c.peep[0]), [10, 12, 14])
  assert.deepEqual(peepParaFio2('baixo', 1)!.exatas[0].peep, [18, 24])
  // ALVEOLI: a coluna "0,5↔0,8 → 20" cobre 0,6 e 0,7
  assert.deepEqual(peepParaFio2('alveoli', 0.6)!.exatas.map((c) => c.peep[0]), [20])
  assert.deepEqual(peepParaFio2('alveoli', 0.5)!.exatas.map((c) => c.peep[0]), [16, 18, 20])
  assert.deepEqual(peepParaFio2('lovs', 0.4)!.exatas[0].peep, [10, 18])
  // sem coluna exata: vizinhas, sem interpolar
  const l = peepParaFio2('baixo', 0.45)!
  assert.equal(l.exatas.length, 0)
  assert.equal(l.anterior!.fio2[0], 0.4)
  assert.equal(l.seguinte!.fio2[0], 0.5)
  assert.equal(peepParaFio2('baixo', 1.2), null)
})

test('SDRA (Tabela 5, p. 506): conferência e marcos de P/F', () => {
  assert.equal(conferirSdra({ pplato: 28, peep: 14, fr: 20, tins: 1, fluxo: 50, ph: 7.3 }).length, 0)
  const a = conferirSdra({ pplato: 32, peep: 10, fr: 30, tins: 1, fluxo: 70 })
  assert.ok(a.some((x) => /Pplatô > 30/.test(x)))
  assert.ok(a.some((x) => /Driving pressure 22/.test(x)))
  assert.ok(a.some((x) => /menor que 1:2/.test(x)))
  assert.ok(a.some((x) => /35–45/.test(x)))
  assert.ok(a.some((x) => /Fluxo fora/.test(x)))
  assert.equal(marcosPf(150).length, 1)
  assert.equal(marcosPf(149).length, 2)
  assert.equal(marcosPf(151).length, 0)
})

test('desmame (Figura 5, p. 510): critérios objetivos e falha do TRE', () => {
  const c = criteriosObjetivosDesmame({ po2: 80, fio2Pct: 40, peep: 6, fc: 100 })
  assert.deepEqual(c.map((x) => x.atende), [true, true, true, true])
  assert.match(c[2].texto, /entre 5 e 8/)
  const d = criteriosObjetivosDesmame({ po2: 55, fio2Pct: 50, peep: 10, fc: 140 })
  assert.deepEqual(d.map((x) => x.atende), [false, false, false, false])
  assert.deepEqual(criteriosObjetivosDesmame({}).map((x) => x.atende), [null, null, null, null])
  assert.equal(falhaTre({ fc: 140, fr: 35, sat: 90, pas: 180 }).length, 0)
  assert.deepEqual(falhaTre({ fc: 141, fr: 36, sat: 89, pas: 89 }), ['FC > 140 bpm', 'FR > 35 rpm', 'SatO2 < 90%', 'PAS < 90 mmHg'])
})
