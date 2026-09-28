import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  FUROSEMIDA_ICA, INFUSOES_IC, classificarFe, criteriosUti, faixaPasFigura, fichaIcAgudaAdulto, furosemidaIca, leituraBnp, leituraNtProBnp,
  levosimendana, mlHFaixaCap, perfilHemodinamico, prognosticoIc, respostaDiuretico,
} from './insuficienciaCardiacaAguda.ts'

const r2 = (x: number) => Math.round(x * 100) / 100

test('ICA: ficha de adulto sem referência pediátrica', () => {
  assert.equal(fichaIcAgudaAdulto.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(fichaIcAgudaAdulto), false)
})

test('ICA: perfis A, B, C, L (p. 291)', () => {
  assert.equal(perfilHemodinamico(false, false), 'A')
  assert.equal(perfilHemodinamico(false, true), 'B')
  assert.equal(perfilHemodinamico(true, true), 'C')
  assert.equal(perfilHemodinamico(true, false), 'L')
})

test('ICA: FE 40% cai em duas faixas; PAS 140 cai em duas colunas da Figura 1', () => {
  assert.equal(classificarFe(40)!.rotulos.length, 2)
  assert.deepEqual(classificarFe(55)!.rotulos, ['preservada (≥ 50%)'])
  assert.deepEqual(faixaPasFigura(140), ['PAS ≥ 140 mmHg', 'PAS 85–140 mmHg'])
  assert.deepEqual(faixaPasFigura(84), ['PAS < 85 mmHg'])
})

test('ICA: prognóstico por três variáveis (p. 292)', () => {
  assert.equal(prognosticoIc(100, 110, 3)!.n, 3)
  assert.match(prognosticoIc(100, 110, 1)!.texto, /15%/)
  assert.match(prognosticoIc(50, 130, 1)!.texto, /não dá/)
})

test('ICA: BNP e NT-proBNP por idade (Tabela 4, p. 293)', () => {
  assert.match(leituraBnp(90)!, /improvável/)
  assert.match(leituraBnp(250)!, /não classifica/)
  assert.match(leituraNtProBnp(1000, 60)!, /≥ 900/)
  assert.match(leituraNtProBnp(1000, 80)!, /não classifica/)
  assert.match(leituraNtProBnp(200, 80)!, /improvável/)
})

test('ICA: furosemida 0,5–1 mg/kg; dobrada; contradição 240 x 400–600 mg anotada (p. 296, 298)', () => {
  const f = furosemidaIca(80)!
  assert.deepEqual(f.doseMg, [40, 80])
  assert.deepEqual(f.dobradaMg, [80, 160])
  assert.equal(f.acimaDe240, false)
  assert.equal(furosemidaIca(150)!.acimaDe240, true)
  assert.match(FUROSEMIDA_ICA.errata, /240/)
})

test('ICA: resposta ao diurético com faixa de corte (p. 298)', () => {
  const r = respostaDiuretico(60, 720)
  assert.deepEqual(r.map((x) => x.leitura), ['entre-cortes', 'entre-cortes'])
  assert.deepEqual(respostaDiuretico(80, 1200).map((x) => x.leitura), ['atinge', 'atinge'])
  assert.deepEqual(respostaDiuretico(30).map((x) => x.leitura), ['nao-atinge'])
})

test('ICA: mL/h na faixa do capítulo com o preparo do Anexo 1 (70 kg)', () => {
  const i = (id: string) => INFUSOES_IC.find((x) => x.id === id)!
  assert.deepEqual(mlHFaixaCap(i('nitroglicerina'), 70), [3, 60]) // 10–200 µg/min a 200 µg/mL
  assert.deepEqual(mlHFaixaCap(i('dobutamina'), 80)!.map(r2), [3, 24]) // 4.000 µg/mL
  assert.equal(mlHFaixaCap(i('levosimendana'), 70), null)
})

test('ICA: levosimendana 0,05–0,1 µg/kg/min por 24 h (p. 297)', () => {
  const l = levosimendana(70)!
  assert.deepEqual(l.ugMin.map(r2), [3.5, 7])
  assert.deepEqual(l.total24hMg.map(r2), [5.04, 10.08])
})

test('ICA: critérios de UTI com sinal vital (p. 302)', () => {
  assert.equal(criteriosUti({ sao2: 88, fr: 30, fc: 135, pas: 85 }).length, 4)
  assert.equal(criteriosUti({ sao2: 95, fr: 20, fc: 90, pas: 120 }).length, 0)
})
