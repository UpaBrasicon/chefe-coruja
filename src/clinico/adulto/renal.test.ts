import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  alvoDiureseRabdo, cpkVezesLsn, fena, feur, fichaLesaoRenalAguda, fichaMcMahon, fichaRabdomiolise, furosemidaEstresse, indicesUrinarios, kdigo,
  manitolRabdo, mcmahon, solucaoBicarbonatoRabdo,
} from './renal.ts'

test('renal: fichas de adulto do manual do HC, sem referência pediátrica', () => {
  for (const f of [fichaLesaoRenalAguda, fichaRabdomiolise, fichaMcMahon]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência.*cap\. 6[13]/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('KDIGO pela creatinina (Tabela 1, p. 825)', () => {
  assert.equal(kdigo({ crBasal: 1, crAtual: 1.2 }).estadio, 0)
  assert.equal(kdigo({ crBasal: 1, crAtual: 1.2, aumento48h: 0.3 }).estadio, 1)
  assert.equal(kdigo({ crBasal: 1, crAtual: 1.5 }).estadio, 1)
  assert.equal(kdigo({ crBasal: 1, crAtual: 2 }).estadio, 2)
  assert.equal(kdigo({ crBasal: 1, crAtual: 3 }).estadio, 3)
  assert.equal(kdigo({ crBasal: 2, crAtual: 4 }).estadio, 3)
  assert.ok(kdigo({ crBasal: 1, crAtual: 1.95 }).avisos.length > 0)
})

test('KDIGO pela diurese e o maior dos dois (Tabela 1, p. 825)', () => {
  // 70 kg, 200 mL em 8 h = 0,357 mL/kg/h
  assert.equal(kdigo({ pesoKg: 70, diureseMl: 200, periodoH: 8 }).estadioDiurese, 1)
  assert.equal(kdigo({ pesoKg: 70, diureseMl: 300, periodoH: 12 }).estadioDiurese, 2)
  assert.equal(kdigo({ pesoKg: 70, diureseMl: 400, periodoH: 24 }).estadioDiurese, 3)
  assert.equal(kdigo({ pesoKg: 70, diureseMl: 100, periodoH: 4 }).estadioDiurese, 0)
  assert.equal(kdigo({ anuriaH: 12 }).estadio, 3)
  assert.equal(kdigo({ crBasal: 1, crAtual: 1.6, pesoKg: 70, diureseMl: 300, periodoH: 12 }).estadio, 2)
  assert.equal(kdigo({ tsr: true }).estadio, 3)
  assert.equal(kdigo({}).estadio, null)
})

test('FENa e FEUr (Tabela 3, p. 832)', () => {
  const f = fena(10, 2, 140, 100)!
  assert.ok(Math.abs(f.valor - 0.142857) < 1e-4)
  assert.match(f.texto, /pré-renal/)
  assert.match(fena(60, 3, 140, 50)!.texto, /NTA/)
  assert.match(fena(30, 2, 140, 40)!.texto, /sem classe/)
  const u = feur(300, 2, 100, 100)!
  assert.equal(u.valor, 6)
  assert.match(u.texto, /pré-renal/)
  assert.equal(fena(0, 1, 1, 1), null)
})

test('índices urinários da Tabela 2 (p. 826–827)', () => {
  const r = indicesUrinarios({ ureiaP: 100, crP: 2, naU: 15, osmU: 600 })
  assert.deepEqual(r.map((x) => x.leitura), ['> 40: sugere pré-renal', '< 20: sugere pré-renal', '> 500: sugere pré-renal'])
})

test('teste de estresse com furosemida: 1 ou 1,5 mg/kg (p. 836)', () => {
  assert.equal(furosemidaEstresse(80, false), 80)
  assert.equal(furosemidaEstresse(80, true), 120)
})

test('rabdomiólise: CPK × LSN, alvo de diurese e soluções da Tabela 3 (p. 854–858)', () => {
  assert.equal(cpkVezesLsn(2000, 200)!.vezes, 10)
  const a = alvoDiureseRabdo(70)!
  assert.deepEqual(a.porPesoMlH, [70, 210])
  assert.equal(a.discordante, false)
  assert.equal(alvoDiureseRabdo(40)!.discordante, true)
  const b = solucaoBicarbonatoRabdo()
  assert.equal(b.meq, 150)
  assert.equal(b.volumeMl, 1150)
  assert.ok(Math.abs(b.meqPorHora - 26.087) < 1e-3)
  assert.equal(b.horasPorBolsa, 5.75)
  assert.deepEqual(manitolRabdo(70), { gPorLitro: 10, gDia: [70, 140] })
})

test('McMahon: soma da Tabela 2 e faixas < 5 e > 10 (p. 856–857)', () => {
  const zero = { idade: 0, sexo: 0, cr: 0, ca: 0, cpk: 0, causa: 0, fosforo: 0, bic: 0 }
  assert.equal(mcmahon.calcular({ idade: 0 }), null)
  assert.match(mcmahon.calcular(zero)!.nota, /2,3%/)
  const meio = mcmahon.calcular({ ...zero, causa: 1, cr: 1, fosforo: 1 })!
  assert.equal(meio.valor, '6')
  assert.match(meio.nota, /não dá o risco/)
  const max = mcmahon.calcular({ idade: 3, sexo: 1, cr: 2, ca: 1, cpk: 1, causa: 1, fosforo: 2, bic: 1 })!
  assert.equal(max.valor, '18')
  assert.match(max.nota, /61%/)
})
