import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  cristaloideAcumulado, fichaTraumaAdulto, hemotorax, mgap, nexus, pontoFrRts, pontoGcsRts, pontoPasRts, regraCanadenseColuna, torniqueteRestante, triageRts, txaTrauma,
} from './trauma.ts'

const TODOS_SIM = { dor: 1, intox: 1, alerta: 1, deficit: 1, distrator: 1 }

test('trauma: fichas de adulto, ids distintos, sem referência pediátrica', () => {
  const fichas = [fichaTraumaAdulto, nexus.ficha, regraCanadenseColuna.ficha, mgap.ficha, triageRts.ficha]
  assert.equal(new Set(fichas.map((f) => f.id)).size, 5)
  for (const f of fichas) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('NEXUS: cinco critérios; > 60 anos e < 14 anos não se aplicam (p. 641, 643)', () => {
  assert.match(nexus.calcular({ idade: 40, ...TODOS_SIM })!.nota, /sem exame de imagem/)
  assert.equal(nexus.calcular({ idade: 40, ...TODOS_SIM, intox: 0 })!.valor, '1 ausente')
  assert.equal(nexus.calcular({ idade: 61, ...TODOS_SIM })!.valor, 'não se aplica')
  assert.equal(nexus.calcular({ idade: 13, ...TODOS_SIM })!.valor, 'não se aplica')
  assert.equal(nexus.calcular({ idade: 40 }), null)
})

test('Regra canadense: alto risco → TC; sem baixo risco → radiografia (errata); rotação (p. 641–642)', () => {
  const c = (r: Record<string, number | boolean>) => regraCanadenseColuna.calcular({ idade: 40, rotacao: 0, ...r })!
  assert.equal(c({ idade: 66 }).valor, 'alto risco')
  assert.equal(c({ queda: true }).valor, 'alto risco')
  assert.equal(c({ parestesia: true }).valor, 'alto risco')
  assert.equal(c({}).valor, 'sem baixo risco')
  assert.equal(c({ deambulando: true }).valor, 'passo 3 pendente')
  assert.equal(c({ deambulando: true, rotacao: 2 }).valor, 'não gira 45°')
  assert.equal(c({ deambulando: true, rotacao: 1 }).valor, 'gira 45°')
  assert.equal(c({ idade: 65 }).valor, 'sem baixo risco') // o livro escreve "> 65"
})

test('MGAP: 3 a 29 pontos; faixas do livro com errata dos rótulos (p. 671)', () => {
  const max = mgap.calcular({ mecanismo: 1, gcs: 15, idade: 0, pas: 0 })! // aberto 4 + 15 + 5 + 5
  assert.equal(max.valor, '29')
  const min = mgap.calcular({ mecanismo: 0, gcs: 3, idade: 1, pas: 2 })!
  assert.equal(min.valor, '3')
  assert.match(min.nota, /3–17/)
  assert.ok(min.alerta)
})

test('Triage-RTS: pontos da Tabela 4 (p. 672) e corte < 11', () => {
  assert.deepEqual([15, 12, 8, 5, 3].map(pontoGcsRts), [4, 3, 2, 1, 0])
  assert.deepEqual([90, 89, 76, 75, 50, 49, 1, 0].map(pontoPasRts), [4, 3, 3, 2, 2, 1, 1, 0])
  assert.deepEqual([10, 29, 30, 9, 6, 5, 1, 0].map(pontoFrRts), [4, 4, 3, 2, 2, 1, 1, 0])
  assert.equal(triageRts.calcular({ gcs: 15, pas: 120, fr: 16 })!.valor, '12')
  const baixo = triageRts.calcular({ gcs: 14, pas: 80, fr: 16 })!
  assert.equal(baixo.valor, '11')
  assert.equal(triageRts.calcular({ gcs: 10, pas: 80, fr: 16 })!.estado, 2)
})

test('TXA (CRASH-2): 1 g em 10 min + 1 g em 8 h, com menos de 3 h (p. 649)', () => {
  const t = txaTrauma(120)!
  assert.equal(t.dentroDaJanela, true)
  assert.equal(t.bolusMgMin, 100)
  assert.equal(t.manutMgH, 125)
  assert.equal(t.minutosRestantes, 60)
  assert.equal(txaTrauma(180)!.dentroDaJanela, false)
})

test('Hemotórax: inicial ≥ 1.500 mL; > 200 mL/h em 2–4 h (p. 644–645)', () => {
  assert.equal(hemotorax(1500)!.inicialAtinge, true)
  const h = hemotorax(800, 700, 3)!
  assert.equal(Math.round(h.debitoMlH!), 233)
  assert.equal(h.debitoAtinge, true)
  assert.equal(h.horasNaJanela, true)
  assert.equal(hemotorax(800, 400, 2)!.debitoAtinge, false) // exatamente 200 não passa
})

test('Torniquete 2 h e cristaloide 1–3 L antes da transfusão (p. 646–647)', () => {
  assert.equal(torniqueteRestante(90), 30)
  assert.equal(torniqueteRestante(130), -10)
  assert.equal(cristaloideAcumulado(500), 'abaixo')
  assert.equal(cristaloideAcumulado(2000), 'dentro')
  assert.equal(cristaloideAcumulado(3500), 'acima')
})
