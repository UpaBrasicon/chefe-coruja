import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { contaImunoterapiaSgb, criteriosVmSgb, egos, fichaSgbAdulto, incapacidadeGbs, lerLcrSgb } from './guillainBarre.ts'
import { contaNimodipino, fichaHsaAdulto, fisherHsa, grauWfns, huntHess, ottawaHsa, wfns } from './hsa.ts'
import { hintsPlus } from './vertigem.ts'

test('neuro E7: todas as fichas são de adulto', () => {
  for (const f of [fichaHsaAdulto, fichaSgbAdulto, ottawaHsa.ficha, huntHess.ficha, wfns.ficha, fisherHsa.ficha, hintsPlus.ficha, criteriosVmSgb.ficha, incapacidadeGbs.ficha, egos.ficha]) {
    assert.equal(f.publico, 'adulto', f.id)
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('Ottawa HSA: qualquer item positivo (Tabela 2, p. 554)', () => {
  const zeros = { idade: 0, cervical: 0, flexao: 0, perda: 0, esforco: 0, thunderclap: 0 }
  assert.equal(ottawaHsa.calcular({ ...zeros, thunderclap: undefined }), null)
  assert.equal(ottawaHsa.calcular(zeros)!.estado, 0)
  const pos = ottawaHsa.calcular({ ...zeros, idade: 1 })!
  assert.equal(pos.valor, '1')
  assert.equal(pos.estado, 2)
})

test('Hunt-Hess I-V e Fisher 1-4 (Tabelas 3 e 5)', () => {
  assert.equal(huntHess.calcular({ grau: 0 })!.valor, 'I')
  assert.equal(huntHess.calcular({ grau: 4 })!.valor, 'V')
  assert.equal(fisherHsa.calcular({ grau: 3 })!.valor, '4')
})

test('WFNS ("CFIN"): Tabela 4 (p. 555), sem linha para Glasgow 15 com déficit', () => {
  assert.equal(grauWfns(15, false), 1)
  assert.equal(grauWfns(15, true), null)
  assert.equal(grauWfns(14, false), 2)
  assert.equal(grauWfns(13, true), 3)
  assert.equal(grauWfns(12, false), 4)
  assert.equal(grauWfns(7, true), 4)
  assert.equal(grauWfns(6, false), 5)
  assert.equal(grauWfns(2, false), null)
  assert.equal(wfns.calcular({ glasgow: 13, deficit: 1 })!.valor, '3')
  assert.equal(wfns.calcular({ glasgow: 15, deficit: 1 })!.valor, '—')
})

test('nimodipino 60 mg 4/4 h por 21 dias (p. 560)', () => {
  assert.deepEqual(contaNimodipino(), { dosesDia: 6, mgDia: 360, dosesTotais: 126, mgTotal: 7560 })
})

test('HINTS plus: achado central em qualquer item (p. 581–583)', () => {
  const periferico = hintsPlus.calcular({ impulso: 0, nistagmo: 0, skew: 0, audicao: 1 })!
  assert.equal(periferico.valor, '0')
  assert.equal(periferico.rotulo, 'HINTS plus')
  const semAudicao = hintsPlus.calcular({ impulso: 1, nistagmo: 0, skew: 0, audicao: 0 })!
  assert.equal(semAudicao.rotulo, 'HINTS')
  assert.equal(semAudicao.estado, 2)
  assert.equal(hintsPlus.calcular({ impulso: 0, nistagmo: 0, skew: 0, audicao: 2 })!.valor, '1')
})

test('SGB: critérios de VM, 1 maior ou 2 menores (Tabela 4, p. 602)', () => {
  assert.equal(criteriosVmSgb.calcular({}), null)
  assert.equal(criteriosVmSgb.calcular({ pco2: 49 })!.valor, 'preenche')
  assert.equal(criteriosVmSgb.calcular({ pco2: 48, po2: 56 })!.valor, 'não preenche')
  const cvf = criteriosVmSgb.calcular({ cvf: 1000, peso: 70 })!
  assert.equal(cvf.valor, 'preenche') // 14,3 mL/kg
  assert.equal(criteriosVmSgb.calcular({ cvf: 1050, peso: 70 })!.valor, 'não preenche') // 15 mL/kg
  assert.ok(criteriosVmSgb.calcular({ cvf: 1000 })!.alerta)
  assert.equal(criteriosVmSgb.calcular({ tosse: true, engolir: true })!.valor, 'preenche')
  assert.equal(criteriosVmSgb.calcular({ tosse: true })!.valor, 'não preenche')
  assert.equal(criteriosVmSgb.calcular({ pimax: 25 })!.valor, 'preenche')
})

test('SGB: incapacidade 0-6 e EGOS 1-7 (Tabelas 5 e 7)', () => {
  assert.equal(incapacidadeGbs.calcular({ grau: 3 })!.estado, 2)
  assert.equal(egos.calcular({ idade: 0, diarreia: 0, gbs: 0 })!.valor, '1')
  assert.equal(egos.calcular({ idade: 1, diarreia: 1, gbs: 3 })!.valor, '5,5')
  assert.equal(egos.calcular({ idade: 2, diarreia: 1, gbs: 4 })!.valor, '7')
})

test('SGB: IgIV 0,4 g/kg/dia × 5 e plasmaférese 250 mL/kg em 5 sessões (p. 604)', () => {
  assert.deepEqual(contaImunoterapiaSgb(70), { igivGDia: 28, igivGTotal: 140, plasmaMlTotal: 17500, plasmaMlSessao: 3500 })
  assert.equal(contaImunoterapiaSgb(0), null)
})

test('SGB: LCR (p. 603–604)', () => {
  assert.equal(lerLcrSgb(80, 2)!.dissociacao, true)
  assert.equal(lerLcrSgb(50, 2)!.dissociacao, false)
  assert.match(lerLcrSgb(80, 20)!.achados.join(' '), /outras etiologias/)
  assert.match(lerLcrSgb(80, 60)!.achados.join(' '), /red flag/)
  assert.equal(lerLcrSgb(-1, 2), null)
})
