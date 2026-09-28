// node --experimental-strip-types --test src/clinico/pediatria/triagem.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Item, Respostas } from '../escore.ts'
import { FAIXAS_POPS, POPS_VITAIS, pews, pontosBanda, pops } from './triagem.ts'

const idx = (id: string, rotulo: string) =>
  (pops.itens.find((x) => x.id === id) as Extract<Item, { tipo: 'escolha' }>).opcoes.findIndex((o) => o.rotulo === rotulo)
const faixa = (id: string) => FAIXAS_POPS.findIndex((f) => f.id === id)
const bem = (f: string, pulso: number, fr: number, temp: number): Respostas => ({
  faixa: faixa(f), so2: idx('so2', '> 95%'), respiracao: idx('respiracao', 'Confortável'), responsividade: idx('responsividade', 'Alerta'),
  impressao: idx('impressao', 'Bem'), outros: idx('outros', 'Hígido'), pulso, fr, temp,
})

test('triagem: fichas do ICr (Tabela 4 e Figura 2)', () => {
  assert.equal(temReferenciaPediatrica(pops.ficha), true)
  assert.equal(temReferenciaPediatrica(pews.ficha), true)
})

test('POPS: faixas da Tabela 4 (p. 882)', () => {
  assert.deepEqual(pontosBanda(POPS_VITAIS['0-1'].pulso, 130).pontos, [0])
  assert.deepEqual(pontosBanda(POPS_VITAIS['0-1'].pulso, 170).pontos, [1])
  assert.deepEqual(pontosBanda(POPS_VITAIS['0-1'].pulso, 181).pontos, [2])
  assert.deepEqual(pontosBanda(POPS_VITAIS['0-1'].pulso, 89).pontos, [2])
  assert.deepEqual(pontosBanda(POPS_VITAIS['5-12'].fr, 30).pontos, [1])
  assert.deepEqual(pontosBanda(POPS_VITAIS['0-1'].temp, 38).pontos, [1])
  assert.deepEqual(pontosBanda(POPS_VITAIS['2-5'].temp, 38).pontos, [0])
  assert.deepEqual(pontosBanda(POPS_VITAIS['13-16'].pulso, 111).pontos, [2])
})

test('POPS — errata: lacunas e sobreposições dão as duas pontuações', () => {
  const lac = pontosBanda(POPS_VITAIS['2-5'].pulso, 80) // "< 80" e "81–94"
  assert.deepEqual(lac.pontos, [1, 2])
  assert.equal(lac.errata, true)
  assert.deepEqual(pontosBanda(POPS_VITAIS['1-2'].fr, 30).pontos, [0, 1]) // 25–35 e 26–50
  assert.deepEqual(pontosBanda(POPS_VITAIS['13-16'].fr, 20).pontos, [0, 1]) // 15–20 e 20–25
  assert.deepEqual(pontosBanda(POPS_VITAIS['1-2'].fr, 40).pontos, [1])
  assert.deepEqual(pontosBanda(POPS_VITAIS['0-1'].temp, 35.95).pontos, [0, 1]) // entre 35,9 e 36,0
})

test('POPS: total, total em faixa e referência acima de 8', () => {
  const r0 = pops.calcular(bem('0-1', 130, 35, 37))!
  assert.equal(r0.valor, '0')
  assert.equal(r0.estado, 0)
  const amb = pops.calcular(bem('2-5', 80, 28, 37))!
  assert.equal(amb.valor, '1 a 2')
  assert.ok(amb.alerta)
  const grave = pops.calcular({ ...bem('5-12', 160, 45, 41), so2: idx('so2', '< 90%'), impressao: idx('impressao', 'Doente') })!
  assert.equal(grave.valor, '10')
  assert.equal(grave.estado, 1)
  assert.match(grave.nota, /acima de 8/)
  assert.equal(pops.calcular({ faixa: 0 }), null)
})

test('PEWS: soma 0–3 × 3 + 2 da oxigenoterapia (Figura 2, p. 883)', () => {
  assert.equal(pews.calcular({ comportamento: 2, cardio: 1, resp: 3, oxigenio: true })!.valor, '8')
  assert.equal(pews.calcular({ comportamento: 0, cardio: 0, resp: 0 })!.valor, '0')
  assert.equal(pews.calcular({ comportamento: 3, cardio: 3, resp: 3, oxigenio: true })!.valor, '11')
  assert.equal(pews.calcular({ comportamento: 0 }), null)
})

test('triagem: sem cor de classificação no resultado', () => {
  const r = pops.calcular(bem('0-1', 130, 35, 37))!
  const texto = [r.valor, r.nota, r.alerta, ...r.derivados.flat(), ...r.cuidados].join(' ')
  assert.doesNotMatch(texto, /vermelh|laranja|amarel|verde|azul/i)
})
