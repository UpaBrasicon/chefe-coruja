// Ferramentas da onda 9 do porte: VM e VNI em cinco passos, calculadoras novas.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from './ficha.ts'
import { ROTA_DA_FICHA } from './indice.ts'
import { ALARMES_LIVRO, checarAjustes, fichaVmPassos, lerAcompanhamento, vtMlKgDoQuadro } from './adulto/vmPassos.ts'
import { CONTRAINDICACOES_VNI, RETIRADA_VNI, fichaVniPassos, lerAcompanhamentoVni, lerAjustesVni } from './adulto/vniPassos.ts'
import { duke, preencheDuke } from './adulto/duke.ts'
import { sincopeSanFrancisco } from './adulto/sincopeSanFrancisco.ts'
import { timiIamcsst } from './escores/timiIamcsst.ts'
import { sincopeCanadense } from './escores/sincopeCanadense.ts'
import { calcularIss, iss } from './escores/iss.ts'
import { ckdEpi, ckdEpi2021, categoriaTfg } from './escores/ckdEpi.ts'
import { pram } from './escores/pram.ts'
import { schwartzPed } from './pediatria/schwartzPed.ts'
import { fichaPhoenixPed } from './pediatria/choque.ts'
import { fichaInfusoesAdulto } from './adulto/infusoes.ts'

const FICHAS = [fichaVmPassos, fichaVniPassos, duke.ficha, sincopeSanFrancisco.ficha, timiIamcsst.ficha, sincopeCanadense.ficha, iss.ficha, ckdEpi.ficha, pram.ficha, schwartzPed.ficha, fichaPhoenixPed]

test('onda 9: toda ficha nova tem fonte, versão nova e rota na Central', () => {
  for (const f of FICHAS) {
    assert.ok(f.fontes.length > 0, f.id)
    assert.equal(f.versao, '2026-09-30.1', f.id)
    assert.ok(ROTA_DA_FICHA[f.id], `sem rota: ${f.id}`)
  }
  assert.ok(ROTA_DA_FICHA[fichaInfusoesAdulto.id].endsWith('/infusoes-adulto'))
})

test('onda 9: adulto não calcula para criança; pediátricas declaram fonte pediátrica', () => {
  for (const f of [fichaVmPassos, fichaVniPassos, duke.ficha, sincopeSanFrancisco.ficha, timiIamcsst.ficha, sincopeCanadense.ficha, iss.ficha, ckdEpi.ficha]) assert.equal(temReferenciaPediatrica(f), false, f.id)
  for (const f of [pram.ficha, schwartzPed.ficha, fichaPhoenixPed]) assert.equal(temReferenciaPediatrica(f), true, f.id)
})

// ---------------------------------------------------------------- VM
test('VM passos: VT pela tabela do quadro (Tabelas 2, 4 e 5; errata 4–6 na SDRA)', () => {
  assert.deepEqual(vtMlKgDoQuadro('inicial'), [6, 8])
  assert.deepEqual(vtMlKgDoQuadro('obstruido'), [6, 6])
  assert.deepEqual(vtMlKgDoQuadro('sdra', 'grave'), [4, 6])
  assert.equal(vtMlKgDoQuadro('sdra'), null)
})

test('VM passos: ajuste inicial VCV dentro da Tabela 2', () => {
  const c = checarAjustes({ quadro: 'inicial', modo: 'vcv', pesoKg: 70, a: { vcMl: 490, fluxoLMin: 60, fr: 14, peep: 5, fio2Pct: 100 } })
  const est = Object.fromEntries(c.linhas.map((l) => [l.parametro, l.estado]))
  assert.equal(est['Volume corrente'], 'ok')
  assert.equal(est['Frequência'], 'ok')
  assert.equal(est['Fluxo inspiratório'], 'ok')
  assert.equal(est['PEEP'], 'ok')
  // Tins = 0,49 s; ciclo 4,29 s; Te 3,8 s → 1:7,7, fora de 1:2–1:3
  assert.equal(est['Relação I:E'], 'fora')
  assert.ok(c.ie && Math.abs(c.ie.n - (60 / 14 - 0.49) / 0.49) < 1e-9)
})

test('VM passos: obstruído grave — FR 8–12, fluxo ≥ 60, I:E ≥ 1:3 e PEEP a 85% da auto-PEEP', () => {
  const c = checarAjustes({ quadro: 'obstruido', modo: 'vcv', pesoKg: 70, a: { vcMl: 420, fluxoLMin: 50, fr: 16, peep: 5, autoPeep: 10 } })
  const est = Object.fromEntries(c.linhas.map((l) => [l.parametro, l.estado]))
  assert.equal(est['Volume corrente'], 'ok')
  assert.equal(est['Frequência'], 'fora')
  assert.equal(est['Fluxo inspiratório'], 'fora')
  assert.equal(est['PEEP'], 'fora') // 85% de 10 = 8,5
})

test('VM passos: SDRA — PEEP pela Tabela 6 (FiO2 0,5 → 8 ou 10) e grave → PEEP alto', () => {
  const ok = checarAjustes({ quadro: 'sdra', modo: 'vcv', pesoKg: 60, classe: 'moderada', a: { vcMl: 360, fluxoLMin: 50, fr: 20, peep: 10, fio2Pct: 50 } })
  assert.equal(ok.linhas.find((l) => l.parametro === 'PEEP')!.estado, 'ok')
  const fora = checarAjustes({ quadro: 'sdra', modo: 'vcv', pesoKg: 60, classe: 'grave', a: { peep: 10, fio2Pct: 50 } })
  assert.equal(fora.linhas.find((l) => l.parametro === 'PEEP')!.estado, 'fora') // ALVEOLI: 0,5 → 16, 18 ou 20
})

test('VM passos: alarmes são só os que as tabelas trazem', () => {
  assert.match(ALARMES_LIVRO.inicial[0].texto, /individualizada/)
  assert.deepEqual(ALARMES_LIVRO.obstruido.map((a) => a.texto), ['Evitar Pplatô > 30 cmH2O', 'Evitar Ppico > 45 cmH2O'])
  const r = lerAcompanhamento('sdra', { pplato: 32, peep: 10, ph: 7.18, sat: 90 })
  assert.equal(r.length, 4)
  assert.equal(lerAcompanhamento('inicial', { pplato: 18, peep: 5, sat: 95 }).length, 0)
})

// ---------------------------------------------------------------- VNI
test('VNI passos: pressões só na DPOC (p. 424); demais quadros sem faixa', () => {
  assert.deepEqual(lerAjustesVni('dpoc', { modo: 'bipap', ipap: 10, epap: 4 }).foraDoLivro, [])
  assert.equal(lerAjustesVni('dpoc', { modo: 'bipap', ipap: 16, epap: 8 }).foraDoLivro.length, 2)
  const eap = lerAjustesVni('eap', { modo: 'bipap', ipap: 16, epap: 8 })
  assert.equal(eap.suporte, 8)
  assert.equal(eap.foraDoLivro.length, 0)
})

test('VNI passos: contraindicações do cap. 27 e da IC aguda; retirada sem fonte', () => {
  assert.equal(CONTRAINDICACOES_VNI.length, 11)
  assert.match(RETIRADA_VNI, /não traz/)
  const a = lerAcompanhamentoVni({ pao2: 55, paco2: 70, naoRetentor: true, sat: 91, alvoSat: 'dpoc' })
  assert.equal(a.invasiva.length, 2)
  assert.match(a.sat!, /dentro de 88–92/)
})

// ---------------------------------------------------------------- escores
test('Duke modificado (Tabela 2, p. 324): 2M, 1M+3m ou 5m', () => {
  assert.equal(preencheDuke(2, 0), true)
  assert.equal(preencheDuke(1, 3), true)
  assert.equal(preencheDuke(1, 2), false)
  assert.equal(preencheDuke(0, 5), true)
  assert.equal(preencheDuke(0, 4), false)
  assert.equal(duke.calcular({ microbiologico: true, febre: true, predisposicao: true, vascular: true })!.estado, 2)
})

test('San Francisco (Tabela 3, p. 238): risco com ≥ 1 fator', () => {
  assert.equal(sincopeSanFrancisco.calcular({})!.estado, 0)
  assert.equal(sincopeSanFrancisco.calcular({ ht: true })!.estado, 1)
})

test('TIMI IAMCSST (Morrow 2000): 0 a 14 e mortalidade por ponto', () => {
  assert.equal(timiIamcsst.calcular({}), null)
  assert.match(timiIamcsst.calcular({ idade: 0 })!.nota, /0,8%/)
  const max = timiIamcsst.calcular({ idade: 2, hist: true, pas: true, fc: true, killip: true, peso: true, anterior: true, tempo: true })!
  assert.equal(max.valor, '14')
  assert.match(max.nota, /35,9%/)
})

test('Canadian Syncope Risk Score: −3 a 11 e cinco categorias', () => {
  assert.equal(sincopeCanadense.calcular({ vasovagal: true, diagnostico: 0 })!.valor, '-3')
  assert.match(sincopeCanadense.calcular({ vasovagal: true, diagnostico: 0 })!.nota, /muito baixo/)
  assert.match(sincopeCanadense.calcular({ diagnostico: 1 })!.nota, /baixo/)
  const max = sincopeCanadense.calcular({ cardiopatia: true, pas: true, troponina: true, eixo: true, qrs: true, qtc: true, diagnostico: 2 })!
  assert.equal(max.valor, '11')
  assert.match(max.nota, /muito alto/)
})

test('ISS (Baker 1974): três maiores ao quadrado; AIS 6 → 75', () => {
  assert.equal(calcularIss([3, 0, 4, 2, 1, 0]), 29)
  assert.equal(calcularIss([6, 0, 0, 0, 0, 0]), 75)
  assert.equal(calcularIss([5, 5, 5, 5, 0, 0]), 75)
  assert.equal(calcularIss([1, 2]), null)
})

test('CKD-EPI 2021 (Inker 2021)', () => {
  assert.equal(Math.round(ckdEpi2021(1.0, 60, 'm')!), 86)
  assert.equal(Math.round(ckdEpi2021(0.7, 50, 'f')!), 105)
  assert.equal(ckdEpi2021(1, 17, 'm'), null)
  assert.equal(categoriaTfg(44.9), 'G3b (30–44)')
  assert.equal(ckdEpi.calcular({ creatinina: 1, idade: 60, sexo: 1 })!.valor, '86')
})

test('Schwartz (ICr, Tabela 2, p. 576): 0,413 × estatura ÷ creatinina', () => {
  assert.equal(schwartzPed.calcular({ estatura: 100, creatinina: 0.5, metodo: 0 })!.valor, '83')
})

test('PRAM (Ducharme 2008): 0–12, leve/moderada/grave', () => {
  const zero = { supraesternal: 0, escalenos: 0, entrada: 0, sibilos: 0, spo2: 0 }
  assert.equal(pram.calcular(zero)!.estado, 0)
  assert.equal(pram.calcular({ ...zero, supraesternal: 1, entrada: 2 })!.valor, '4')
  assert.equal(pram.calcular({ supraesternal: 1, escalenos: 1, entrada: 3, sibilos: 3, spo2: 2 })!.valor, '12')
})
