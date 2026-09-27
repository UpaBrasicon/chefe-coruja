import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ESTREPTOQUINASE, ajustarHnf, alteplaseIam, alteplaseTepAlternativo, bivalirudinaMgH, edoxabanaMg, enoxaparina,
  fichaAnticoagulacaoPlenaAdulto, fichaFibrinoliticosAdulto, fichaHnfAdulto, fondaparinuxMg, hnfSc, inicioHnf, mgHDaFase, mlHDeUIH,
  tenecteplase, uiPorHora,
} from './anticoagulacao.ts'

test('anticoagulação: três fichas de adulto, ids distintos, sem referência pediátrica', () => {
  const fichas = [fichaHnfAdulto, fichaAnticoagulacaoPlenaAdulto, fichaFibrinoliticosAdulto]
  assert.equal(new Set(fichas.map((f) => f.id)).size, 3)
  for (const f of fichas) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('HNF EV: 80 UI/kg em bolus + 18 UI/kg/h (p. 442)', () => {
  assert.deepEqual(inicioHnf(80), { bolusUI: 6400, infusaoUIH: 1440 })
  assert.equal(inicioHnf(0), null)
})

test('HNF EV: nomograma da Tabela 7 (p. 442), linha por linha e nas bordas', () => {
  const a = (ttpa: number) => ajustarHnf(ttpa, 80, 18)!
  assert.deepEqual([a(30).novoBolusUI, a(30).novaInfusaoUIKgH, a(30).linha.pararMin], [6400, 22, 0])
  assert.deepEqual([a(34.9).linha.faixa, a(35).linha.faixa], ['< 35 s', '35–45 s'])
  assert.deepEqual([a(40).novoBolusUI, a(40).novaInfusaoUIKgH], [3200, 20])
  assert.deepEqual([a(45).linha.faixa, a(46).linha.faixa], ['35–45 s', '46–70 s'])
  assert.deepEqual([a(60).novoBolusUI, a(60).novaInfusaoUIKgH], [null, 18])
  assert.deepEqual([a(70).linha.faixa, a(71).linha.faixa], ['46–70 s', '71–90 s'])
  assert.deepEqual([a(80).novaInfusaoUIKgH, a(80).novaInfusaoUIH], [16, 1280])
  assert.deepEqual([a(90).linha.faixa, a(91).linha.faixa], ['71–90 s', '> 90 s'])
  assert.deepEqual([a(100).linha.pararMin, a(100).novaInfusaoUIKgH, a(100).novoBolusUI], [60, 15, null])
  assert.equal(ajustarHnf(0, 80, 18), null)
  assert.equal(ajustarHnf(100, 80, 1)!.novaInfusaoUIKgH, 0) // não fica negativa
})

test('HNF EV: mL/h só com concentração informada (o livro não traz diluição)', () => {
  assert.equal(mlHDeUIH(1440, 100), 14.4)
  assert.equal(mlHDeUIH(1440, 0), null)
})

test('enoxaparina: 1 mg/kg 12/12 h no IAM sem supra (p. 207) e 1,5 mg/kg 1 x/dia na TVP (p. 352)', () => {
  assert.deepEqual([enoxaparina('iamsst', { pesoKg: 80 })!.doseMg, enoxaparina('iamsst', { pesoKg: 80 })!.intervalo], [80, '12/12 h SC'])
  assert.deepEqual([enoxaparina('tvp', { pesoKg: 80 })!.doseMg, enoxaparina('tvp', { pesoKg: 80 })!.intervalo], [120, '1 vez ao dia SC'])
})

test('enoxaparina no TEP: ajuste renal < 30 e não usar < 15 (p. 441–442)', () => {
  assert.equal(enoxaparina('tep-12h', { pesoKg: 80, clcr: 60 })!.doseMg, 80)
  assert.equal(enoxaparina('tep-1x', { pesoKg: 80, clcr: 60 })!.doseMg, 120)
  const renal = enoxaparina('tep-12h', { pesoKg: 80, clcr: 29 })!
  assert.deepEqual([renal.doseMg, renal.intervalo], [80, '1 vez ao dia SC'])
  assert.equal(enoxaparina('tep-1x', { pesoKg: 80, clcr: 20 })!.doseMg, 80)
  assert.equal(enoxaparina('tep-12h', { pesoKg: 80, clcr: 14 })!.doseMg, null)
})

test('enoxaparina após trombólise no IAM com supra (p. 219): bolus 30 mg, > 75 anos e ClCr 15–30', () => {
  const base = enoxaparina('iamcsst-trombolise', { pesoKg: 80, idadeAnos: 60 })!
  assert.deepEqual([base.bolusEvMg, base.doseMg, base.intervalo], [30, 80, '12/12 h SC'])
  const idoso = enoxaparina('iamcsst-trombolise', { pesoKg: 80, idadeAnos: 76 })!
  assert.deepEqual([idoso.bolusEvMg, idoso.doseMg], [null, 60])
  assert.equal(enoxaparina('iamcsst-trombolise', { pesoKg: 80, idadeAnos: 75 })!.bolusEvMg, 30) // "maior que 75"
  const renal = enoxaparina('iamcsst-trombolise', { pesoKg: 80, idadeAnos: 60, clcr: 25 })!
  assert.deepEqual([renal.doseMg, renal.intervalo], [80, '1 vez ao dia SC'])
  const sk = enoxaparina('iamcsst-trombolise', { pesoKg: 80, idadeAnos: 60, estreptoquinase: true })!
  assert.equal(sk.bolusEvMg, null)
  assert.ok(sk.observacoes.some((o) => /24 horas/.test(o)))
  assert.equal(enoxaparina('iamcsst-trombolise', { pesoKg: 80, clcr: 10 })!.doseMg, null)
})

test('fondaparinux por faixa de peso e ClCr < 30 (p. 352)', () => {
  assert.deepEqual([49, 50, 100, 101].map((p) => fondaparinuxMg(p)), [5, 7.5, 7.5, 10])
  assert.equal(fondaparinuxMg(70, 29), null)
  assert.equal(fondaparinuxMg(70, 30), 7.5)
})

test('HNF SC concentrada: 333 U/kg e 250 U/kg 12/12 h, em 20.000 e 25.000 U/mL (p. 352)', () => {
  const r = hnfSc(60)!
  assert.deepEqual([r.inicialU, r.manutencaoU], [19980, 15000])
  assert.deepEqual(r.volumes.map((v) => [Math.round(v.inicialMl * 100) / 100, v.manutencaoMl]), [[1, 0.75], [0.8, 0.6]])
})

test('bivalirudina 0,15 mg/kg/h (p. 352) e edoxabana sem dose em 60 kg exatos (errata p. 443)', () => {
  assert.deepEqual(bivalirudinaMgH([0.15, 0.15], 80)!.map((x) => Math.round(x * 100) / 100), [12, 12])
  assert.deepEqual([edoxabanaMg(59), edoxabanaMg(60), edoxabanaMg(61)], [30, null, 60])
})

test('alteplase no IAM com supra: 100 mg se ≥ 65 kg; 15 mg + 0,75 + 0,5 mg/kg se < 65 kg (p. 218)', () => {
  const g = alteplaseIam(80)!
  assert.deepEqual([g.fases.map((f) => f.mg), g.totalMg], [[15, 50, 35], 100])
  assert.deepEqual(g.fases.map(mgHDaFase), [null, 100, 35])
  const p = alteplaseIam(60)!
  assert.deepEqual([p.fases.map((f) => f.mg), p.totalMg], [[15, 45, 30], 90])
  assert.equal(alteplaseIam(65)!.totalMg, 100)
})

test('tenecteplase por faixa de peso, metade > 75 anos, bordas 70/80 kg ambíguas (p. 218–219)', () => {
  assert.deepEqual([59, 65, 75, 85, 90, 91].map((p) => tenecteplase(p)!.mg[0]), [30, 35, 40, 45, 45, 50])
  assert.deepEqual([tenecteplase(70)!.mg, tenecteplase(70)!.bordaAmbigua], [[35, 40], true])
  assert.deepEqual(tenecteplase(80)!.mg, [40, 45])
  assert.deepEqual(tenecteplase(95, 80)!.mg, [25, 25])
  assert.deepEqual(tenecteplase(95, 75)!.mg, [50, 50])
})

test('estreptoquinase: 1.500.000 U em 1 h (IAM) e em 2 h (TEP); errata "100 UI/h" sem cálculo (p. 218, 443)', () => {
  assert.equal(uiPorHora(ESTREPTOQUINASE.iam), 1_500_000)
  assert.equal(uiPorHora(ESTREPTOQUINASE.tepPreferivel), 750_000)
  assert.match(ESTREPTOQUINASE.tepAlternativo.errata, /100 UI\/h/)
  assert.equal('manutencaoUIH' in ESTREPTOQUINASE.tepAlternativo, false)
})

test('rtPA no TEP: 0,6 mg/kg em 15 min com máximo de 50 mg (p. 443)', () => {
  assert.deepEqual(alteplaseTepAlternativo(70), { mg: 42, limitadoAoTeto: false })
  assert.deepEqual(alteplaseTepAlternativo(100), { mg: 50, limitadoAoTeto: true })
})
