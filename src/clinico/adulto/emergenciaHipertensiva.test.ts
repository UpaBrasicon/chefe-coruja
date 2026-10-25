import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ESMOLOL_EH, MAGNESIO_PE, METAS_EH, OMS_MCPC_2017, TOXICIDADE_MAGNESIO, addRs, mlSulfatoMagnesio, esmololEH, fichaEmergenciaHipertensivaAdulto, fichaSindromeAorticaAdulto, hidralazinaSaldo, linhaDiametro,
  nitroglicerinaMlH, nitroprussiatoMlH, pamAlvo, regraGeralEH,
} from './emergenciaHipertensiva.ts'

const r1 = (x: number) => Math.round(x * 10) / 10

test('EH/aorta: fichas de adulto, ids distintos, sem referência pediátrica', () => {
  const fichas = [fichaEmergenciaHipertensivaAdulto, fichaSindromeAorticaAdulto, addRs.ficha]
  assert.equal(new Set(fichas.map((f) => f.id)).size, 3)
  for (const f of fichas) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('EH: regra geral — PAS 220 → 165–176 em até 1 h; 160/100 em 2–6 h (p. 275)', () => {
  const g = regraGeralEH(220)!
  assert.deepEqual(g.pasEmAte1h, [165, 176])
  assert.deepEqual(g.alvo2a6h, { pas: 160, pad: 100 })
})

test('EH: PAM informada reduzida em 15% (AVCI) e 20–25% (encefalopatia) — Tabela 4', () => {
  assert.deepEqual(pamAlvo(140, [15, 15])!.map(r1), [119, 119])
  assert.deepEqual(pamAlvo(160, [20, 25]), [120, 128])
  const d = METAS_EH.find((m) => m.id === 'disseccao')!
  assert.match(d.tempo, /FC abaixo de 60/)
  assert.ok(d.errata)
})

test('EH: esmolol com a errata de unidade — ataque em mg/kg; 50–200 µg/kg/min a 10 mg/mL (Tabela 3, p. 273)', () => {
  assert.ok(ESMOLOL_EH.errata.includes('mg/kg/min'))
  const e = esmololEH(80)!
  assert.deepEqual(e.ataqueMg, [40, 80])
  assert.deepEqual(e.manutMlH, [24, 96])
})

test('EH: nitroprussiato e nitroglicerina na concentração de 200 µg/mL (Tabela 3 = Anexo 1)', () => {
  assert.equal(nitroprussiatoMlH(80, 0.25), 6)
  assert.equal(nitroprussiatoMlH(80, 10), 240)
  assert.equal(nitroglicerinaMlH(5), 1.5)
  assert.equal(nitroglicerinaMlH(10), 3)
})

test('EH: hidralazina — saldo até 30 mg em 24 h', () => {
  assert.equal(hidralazinaSaldo(5), 25)
  assert.equal(hidralazinaSaldo(35), 0)
})

test('ADD-RS: uma coluna vale 1 ponto mesmo com vários itens; D-dímero para 0–1 (Tabela 2, p. 281–282)', () => {
  const r0 = addRs.calcular({})!
  assert.equal(r0.valor, '0')
  assert.match(r0.nota, /dosar o D-dímero/)
  const neg = addRs.calcular({ abrupta: true, intensa: true, rasgante: true, ddimero: 300 })!
  assert.equal(neg.valor, '1')
  assert.match(neg.nota, /não é necessário continuar/)
  const pos = addRs.calcular({ marfan: true, ddimero: 500 })!
  assert.match(pos.nota, /≥ 500/)
  const dois = addRs.calcular({ marfan: true, pulso: true })!
  assert.equal(dois.valor, '2')
  assert.match(dois.nota, /angiotomografia/)
})

test('Aorta: Tabela 3 por diâmetro (p. 284)', () => {
  assert.equal(linhaDiametro(3.5), null)
  assert.equal(linhaDiametro(4.2)!.total, '5,3%')
  assert.equal(linhaDiametro(6.5)!.morte, '10,8%')
})

// ── Sulfato de magnésio na pré-eclâmpsia grave e eclâmpsia (OMS; lote 3) ──

test('magnésio: ficha .1 com o manual da OMS ao lado do manual do HC e da DBHA', () => {
  assert.equal(fichaEmergenciaHipertensivaAdulto.versao, '2026-10-25.1')
  assert.ok(fichaEmergenciaHipertensivaAdulto.fontes.includes(OMS_MCPC_2017))
  assert.match(OMS_MCPC_2017.citacao, /Box S-4.*p\. S-59/)
})
test('magnésio: volumes do Box S-4 — 20% = 0,2 g/mL e 50% = 0,5 g/mL', () => {
  assert.equal(mlSulfatoMagnesio(MAGNESIO_PE.ev.ataque), 8)
  assert.equal(mlSulfatoMagnesio(MAGNESIO_PE.im.ataqueEv), 20)
  assert.equal(mlSulfatoMagnesio(MAGNESIO_PE.im.ataqueIm), 20)
  assert.equal(mlSulfatoMagnesio(MAGNESIO_PE.im.manutencao), 10)
  assert.equal(mlSulfatoMagnesio(MAGNESIO_PE.recorrencia.dose), 4)
})
test('magnésio: doses fixas da OMS (4 g + 1 g/h EV; 4 g EV + 10 g IM e 5 g IM 4/4 h)', () => {
  assert.equal(MAGNESIO_PE.ev.ataque.g, 4)
  assert.equal(MAGNESIO_PE.ev.manutencaoGH, 1)
  assert.equal(MAGNESIO_PE.im.ataqueIm.g, 10)
  assert.equal(MAGNESIO_PE.im.intervaloH, 4)
  assert.match(MAGNESIO_PE.duracao, /24 horas após o parto ou a última convulsão/)
})
test('magnésio: sinais para suspender e gluconato de cálcio 1 g (Box S-5)', () => {
  assert.equal(TOXICIDADE_MAGNESIO.suspender.length, 3)
  assert.equal(TOXICIDADE_MAGNESIO.antidoto.ml, 10)
})
