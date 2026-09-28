import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  OPIOIDES, SEDACAO_PALIATIVA, bps, doseDiariaMg, escalaNumericaDor, escalonarBolus, esquemasOpioide, faixaPainad,
  fichaDorAnalgesiaAdulto, fichaPaliativoAdulto, furosemidaDispneia, intensidadeNumerica, meperidinaMaximos, morfinaEvMl,
  opioidePorPeso, painad, quetaminaAnalgesica, resgateOpioide, sedacaoPaliativa,
} from './dorAnalgesia.ts'

const op = (id: string) => OPIOIDES.find((x) => x.id === id)!
const r2 = (x: number) => Math.round(x * 100) / 100

test('dor: fichas de adulto do manual do HC, sem referência pediátrica', () => {
  for (const f of [fichaDorAnalgesiaAdulto, fichaPaliativoAdulto, escalaNumericaDor.ficha, painad.ficha, bps.ficha]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
  for (const o of OPIOIDES) assert.match(o.pagina, /^p\. \d+/, o.id)
})

test('escala numérica: faixas da escada (Figura 2, p. 147) e limites', () => {
  assert.deepEqual([0, 1, 3, 4, 6, 7, 10].map(intensidadeNumerica), ['sem dor', 'leve', 'leve', 'moderada', 'moderada', 'intensa', 'intensa'])
  assert.equal(intensidadeNumerica(11), null)
  assert.equal(escalaNumericaDor.calcular({}), null)
  const r = escalaNumericaDor.calcular({ nota: 8 })!
  assert.equal(r.nota, 'Dor intensa')
  assert.match(r.derivados[0][1], /^3º degrau: Opioides fortes/)
  assert.equal(escalaNumericaDor.calcular({ nota: 0 })!.derivados.length, 0)
})

test('PAINAD: 5 itens 0–2, faixas 1–3/4–6/7–10 (p. 143); 0 sem faixa', () => {
  assert.equal(painad.calcular({ respiracao: 1 }), null)
  const todos = (i: number) => ({ respiracao: i, vocalizacao: i, facial: i, corporal: i, consolabilidade: i })
  assert.equal(painad.calcular(todos(2))!.valor, '10')
  assert.equal(painad.calcular(todos(1))!.nota, 'dor moderada (4–6)')
  assert.equal(painad.calcular(todos(0))!.nota, 'sem faixa no livro (0 ponto)')
  assert.deepEqual([3, 4, 6, 7].map(faixaPainad), ['dor leve (1–3)', 'dor moderada (4–6)', 'dor moderada (4–6)', 'dor grave (7–10)'])
})

test('BPS: 3 itens de 1 a 4 (Tabela 2, p. 143), total 3–12, sem faixa', () => {
  assert.equal(bps.calcular({ facial: 0, membros: 0, ventilador: 0 })!.valor, '3')
  const r = bps.calcular({ facial: 3, membros: 2, ventilador: 3 })! // 4 + 3 + 4
  assert.equal(r.valor, '11')
  assert.equal(bps.calcular({ facial: 3, membros: 3, ventilador: 3 })!.valor, '12')
  assert.match(r.nota, /não traz ponto de corte/)
})

test('opioides: doses diárias e máximos da Tabela 3 (p. 147–149)', () => {
  assert.equal(doseDiariaMg(60, 4), 360)
  const cod = esquemasOpioide(op('codeina'))
  assert.deepEqual(cod.map((e) => [e.doseMg, e.intervaloH, e.diaMg, e.acimaDoMaximo]), [[30, 4, 180, false], [30, 6, 120, false], [60, 4, 360, false], [60, 6, 240, false]])
  assert.deepEqual(esquemasOpioide(op('tramadol')).map((e) => e.diaMg), [200, 400])
  assert.deepEqual(esquemasOpioide(op('oxicodona')).map((e) => [e.diaMg, e.acimaDoMaximo]), [[20, false], [40, false], [80, false]])
  assert.deepEqual(esquemasOpioide(op('fentanil-td')), [])
  assert.equal(doseDiariaMg(10, 0), null)
})

test('opioides por peso: fentanil 1–2 µg/kg, morfina 0,05–0,1 mg/kg a 1 mg/mL, meperidina IM 1–3 mg/kg', () => {
  assert.deepEqual(opioidePorPeso(op('fentanil'), 70), [70, 140])
  assert.deepEqual(morfinaEvMl(50)!.map(r2), [2.5, 5]) // "2,5 a 5 mL" do livro = 50 kg
  assert.deepEqual(opioidePorPeso(op('meperidina'), 70), [70, 210])
  assert.deepEqual(meperidinaMaximos(70), { fixoMg: 1000, porPesoMg: 1400, divergem: true })
  assert.equal(opioidePorPeso(op('codeina'), 70), null)
  assert.ok(op('meperidina').errata)
})

test('quetamina analgésica: 0,2–0,4 mg/kg, 1–2 µg/kg/min (p. 1384) e 0,1–0,5 mg/kg (p. 150), preparo do Anexo 1', () => {
  const q = quetaminaAnalgesica(70)!
  assert.deepEqual([q.bolusMg.map(r2), q.bolusCap9Mg.map(r2)], [[14, 28], [7, 35]])
  assert.deepEqual(q.infusaoMgH.map(r2), [4.2, 8.4])
  assert.equal(q.mgMl, 1)
  assert.deepEqual(q.infusaoMlH.map(r2), [4.2, 8.4])
  assert.equal(quetaminaAnalgesica(0), null)
})

test('paliativo: resgate de 1/6 da dose total diária e aumento de 50–100% (p. 1384)', () => {
  assert.deepEqual(resgateOpioide(60), { resgateMg: 10, novaTotalMg: [90, 120] })
  assert.equal(resgateOpioide(0), null)
})

test('paliativo: dispneia — morfina 2 mg → 3–4 mg, infusão 50% do bolus; furosemida 0,5–1 mg/kg (p. 1385)', () => {
  assert.deepEqual(escalonarBolus(2), { proximoMg: [3, 4], infusaoMgH: 1 })
  assert.deepEqual(furosemidaDispneia(60), [30, 60])
})

test('paliativo: sedação com midazolam 1 mg/mL, manutenção 50% do bolus, alerta acima de 15–20 mg/h (p. 1388)', () => {
  assert.deepEqual(sedacaoPaliativa(5), { manutencaoPeloBolusMgH: 2.5, mlH: 2.5, acimaDoLimite: false })
  assert.equal(sedacaoPaliativa(5, 18)!.acimaDoLimite, 'faixa')
  assert.equal(sedacaoPaliativa(5, 21)!.acimaDoLimite, true)
  assert.deepEqual([SEDACAO_PALIATIVA.bolusMg, SEDACAO_PALIATIVA.manutencaoMgH], [[2.5, 5], [0.5, 2.5]])
})
