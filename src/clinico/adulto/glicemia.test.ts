import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  DIVERGENCIAS_CAD, ERRATA_OSMOLARIDADE, HIPOGLICEMIA_DOSES, INSULINA_BOMBA, POTASSIO_MANUAL, TABELA_GRAVIDADE, abaixoDoLimiar, ajusteInsulina, anionGap,
  bicarbonato, concentracaoInsulina, criteriosCad, criteriosEhh, criteriosResolucao, duasBolsas, faixaPotassio, fichaCadEhhAvaliacao,
  fichaCadEhhTratamento, fichaHipoglicemia, gramasGlicose50, gravidadePorBicarbonato, gravidadePorPh, hidratacao, insulinaInicial, insulinaReduzida,
  osmolaridadeEfetiva, solucaoSegundaFase, transicaoSc,
} from './glicemia.ts'
import { sodioCorrigido } from './sodio.ts'

const r1 = (x: number | null | undefined) => Math.round(x! * 10) / 10

test('glicemia: fichas do manual HCFMUSP, adulto, ids distintos', () => {
  const fichas = [fichaCadEhhAvaliacao, fichaCadEhhTratamento, fichaHipoglicemia]
  for (const f of fichas) {
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência/)
    assert.equal(f.publico, 'adulto')
    assert.equal(temReferenciaPediatrica(f), false)
    assert.match(f.id, /^adulto-/)
  }
  assert.equal(new Set(fichas.map((f) => f.id)).size, 3)
})

test('CAD/EHH: critérios diagnósticos nos cortes da p. 864', () => {
  assert.deepEqual(criteriosCad(251, 7.29, true), { glicemia: true, ph: true, cetose: true, preenche: true })
  assert.equal(criteriosCad(250, 7.1, true)!.preenche, false) // glicemia precisa ser > 250
  assert.equal(criteriosCad(400, 7.3, true)!.preenche, false) // pH precisa ser < 7,3
  assert.equal(criteriosCad(400, 7.1, null)!.preenche, null) // cetose não informada
  assert.equal(criteriosEhh(601, 321, 7.31)!.preenche, true)
  assert.equal(criteriosEhh(600, 321, 7.31)!.preenche, false)
  assert.equal(criteriosEhh(700, 320, 7.35)!.preenche, false)
  assert.equal(criteriosEhh(700, 330, 7.3)!.preenche, false)
})

test('CAD: gravidade pela Tabela 1 (p. 864–865)', () => {
  assert.equal(gravidadePorPh(7.3), 'leve')
  assert.equal(gravidadePorPh(7.25), 'leve')
  assert.equal(gravidadePorPh(7.24), 'moderada')
  assert.equal(gravidadePorPh(7.0), 'moderada')
  assert.equal(gravidadePorPh(6.99), 'grave')
  assert.equal(gravidadePorPh(7.31), null)
  assert.equal(gravidadePorBicarbonato(18), 'leve')
  assert.equal(gravidadePorBicarbonato(15), 'leve')
  assert.equal(gravidadePorBicarbonato(14.9), 'moderada')
  assert.equal(gravidadePorBicarbonato(10), 'moderada')
  assert.equal(gravidadePorBicarbonato(9.9), 'grave')
  assert.equal(gravidadePorBicarbonato(19), null)
  assert.equal(TABELA_GRAVIDADE.leve.anionGap, '> 10')
  assert.equal(TABELA_GRAVIDADE.grave.consciencia, 'Estupor ou coma')
})

test('fórmulas: ânion-gap (p. 935) e osmolaridade efetiva com a fração corrigida (p. 869)', () => {
  assert.equal(anionGap(135, 100, 10), 25)
  assert.equal(anionGap(0, 100, 10), null)
  const na = sodioCorrigido(130, 800)! // 130 + 1,6 × 7 = 141,2
  assert.equal(r1(na), 141.2)
  // 2 × 141,2 + 800/18 = 282,4 + 44,4 = 326,8
  assert.equal(r1(osmolaridadeEfetiva(na, 800)), 326.8)
  // o traço de fração impresso daria (282,4 + 800)/18 ≈ 60 — errata
  assert.ok(osmolaridadeEfetiva(na, 800)! > 250)
  assert.match(ERRATA_OSMOLARIDADE, /p\. 869/)
})

test('resolução: 2 de 3 (pH > 7,3; AG ≤ 12; bicarbonato ≥ 15) (p. 871–873)', () => {
  assert.equal(criteriosResolucao(7.31, 12, 14)!.desligarBomba, true)
  assert.equal(criteriosResolucao(7.3, 12, 14)!.desligarBomba, false)
  assert.equal(criteriosResolucao(7.2, 13, 15)!.presentes, 1)
  assert.equal(criteriosResolucao(7.35, 10, 18)!.presentes, 3)
})

test('hidratação: 1ª hora e 2ª fase (p. 869; Figuras 2–3)', () => {
  const h = hidratacao(70)!
  assert.deepEqual(h.primeiraHoraMl, [1000, 1500])
  assert.deepEqual(h.primeiraHoraPorPesoMl, [1050, 1400])
  assert.deepEqual(h.segundaFaseMlH, [250, 500])
  assert.deepEqual(h.segundaFasePorPesoMlH, [280, 980])
  assert.equal(solucaoSegundaFase(134), '0,9%')
  assert.equal(solucaoSegundaFase(135), '0,45%')
  assert.equal(hidratacao(0), null)
})

test('insulina: 50 U/250 mL → 5 mL = 1 U; bolus 0,1 U/kg + 0,1 U/kg/h ou 0,14 sem bolus (p. 871)', () => {
  assert.equal(INSULINA_BOMBA.unidades, 50)
  assert.equal(concentracaoInsulina(), 0.2)
  const c = insulinaInicial(70, 'com-bolus')!
  assert.equal(r1(c.bolusU), 7)
  assert.equal(r1(c.uH), 7)
  assert.equal(r1(c.mlH), 35)
  const s = insulinaInicial(70, 'sem-bolus')!
  assert.equal(s.bolusU, 0)
  assert.equal(r1(s.uH), 9.8)
  assert.equal(r1(s.mlH), 49)
  assert.equal(r1(insulinaReduzida(70)!.uH), 3.5)
  assert.equal(insulinaInicial(0, 'com-bolus'), null)
})

test('insulina: ajuste pela queda horária de 50–70 mg/dL (p. 871)', () => {
  assert.deepEqual(ajusteInsulina(400, 360, 7), { queda: 40, acao: 'dobrar', novaUH: 14 })
  assert.deepEqual(ajusteInsulina(400, 350, 7), { queda: 50, acao: 'manter', novaUH: 7 })
  assert.deepEqual(ajusteInsulina(400, 330, 7), { queda: 70, acao: 'manter', novaUH: 7 })
  assert.deepEqual(ajusteInsulina(400, 320, 7), { queda: 80, acao: 'metade', novaUH: 3.5 })
  assert.equal(ajusteInsulina(400, 450, 7)!.acao, 'dobrar') // subiu
})

test('potássio: < 3,3 / 3,3–5,0 / > 5 (p. 871, 874)', () => {
  assert.equal(faixaPotassio(3.2), 'baixo')
  assert.equal(faixaPotassio(3.3), 'intermediario')
  assert.equal(faixaPotassio(5), 'intermediario')
  assert.equal(faixaPotassio(5.1), 'alto')
  assert.match(POTASSIO_MANUAL.baixo[0], /25 mEq/)
  assert.match(POTASSIO_MANUAL.baixo[0], /19,1%/)
})

test('bicarbonato: só pH < 6,9 — 100 mEq em 2 h; 100 mL 8,4% + 400 mL AD (p. 874, 938)', () => {
  assert.equal(bicarbonato(6.9)!.indicado, false)
  const b = bicarbonato(6.85)!
  assert.equal(b.indicado, true)
  assert.equal(b.meq, 100)
  assert.equal(b.mlH, 250)
})

test('duas bolsas: reproduz a Tabela 5 (p. 870)', () => {
  const linhas: [number, number, number][] = [[0, 500, 0], [2.5, 375, 125], [5, 250, 250], [7.5, 125, 375], [10, 0, 500]]
  for (const [d, b1, b2] of linhas) assert.deepEqual(duasBolsas(500, d), { bolsa1: b1, bolsa2: b2 }, `D${d}`)
  assert.equal(duasBolsas(500, 11), null)
})

test('transição SC: 2/3 da dose de 24 h ou 0,6 U/kg de NPH (p. 874)', () => {
  const t = transicaoSc(60, 70)
  assert.equal(t.doisTercos, 40)
  assert.equal(r1(t.nphPorPeso), 42)
  assert.equal(transicaoSc(0, 0).doisTercos, null)
})

test('divergências texto × fluxogramas do cap. 64 estão registradas', () => {
  assert.ok(DIVERGENCIAS_CAD.length >= 8)
  assert.ok(DIVERGENCIAS_CAD.some((d) => d.figura.includes('5,2')))
})

test('hipoglicemia: limiares e doses (p. 877, 880–881)', () => {
  assert.equal(abaixoDoLimiar(44, false), true)
  assert.equal(abaixoDoLimiar(45, false), false)
  assert.equal(abaixoDoLimiar(69, true), true)
  assert.equal(abaixoDoLimiar(70, true), false)
  assert.deepEqual(HIPOGLICEMIA_DOSES.glicose50Ml, [60, 100])
  assert.deepEqual(HIPOGLICEMIA_DOSES.glucagonMg, [1, 2])
  assert.equal(HIPOGLICEMIA_DOSES.tiaminaMg, 100)
  assert.equal(gramasGlicose50(60), 30)
  assert.equal(gramasGlicose50(100), 50)
})
