// node --experimental-strip-types --test src/clinico/pediatria/tceDecisao.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Escore, Item, Respostas } from '../escore.ts'
import { calcularDose } from './fonteP2.ts'
import { DOSES_TCE, glasgowPediatrico, pecarnMaior2, pecarnMenor2 } from './tceDecisao.ts'

const com = (e: Escore, ...ids: string[]): Respostas => Object.fromEntries(e.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))
const item = (e: Escore, id: string) => e.itens.find((i) => i.id === id) as Extract<Item, { tipo: 'escolha' }>

test('pecarn: fichas pediátricas do ICr (Figuras 2 e 3, p. 176)', () => {
  for (const e of [pecarnMenor2, pecarnMaior2, glasgowPediatrico]) assert.equal(temReferenciaPediatrica(e.ficha), true)
  assert.equal(pecarnMenor2.itens.length, 6)
  assert.equal(pecarnMaior2.itens.length, 7)
})

test('pecarn < 2 anos: os três ramos da Figura 2', () => {
  const nenhum = pecarnMenor2.calcular(com(pecarnMenor2))!
  assert.equal(nenhum.valor, 'Nenhum critério')
  assert.match(nenhum.derivados[0][1], /TC não recomendada/)
  const q2 = pecarnMenor2.calcular(com(pecarnMenor2, 'hematoma'))!
  assert.equal(q2.valor, '2º quadro — sim')
  assert.match(q2.derivados[1][1], /idade < 3 meses/)
  const q1 = pecarnMenor2.calcular(com(pecarnMenor2, 'base', 'hematoma'))!
  assert.equal(q1.valor, '1º quadro — sim') // o 1º quadro vem antes
  assert.equal(q1.estado, 2)
  assert.match(String(item(pecarnMenor2, 'mecanismo').ajuda), /0,9 m/)
})

test('pecarn ≥ 2 anos: cada item do 2º quadro; mecanismo 1,5 m; incompleto = null', () => {
  for (const id of ['perda', 'vomitos', 'mecanismo', 'cefaleia']) assert.equal(pecarnMaior2.calcular(com(pecarnMaior2, id))!.valor, '2º quadro — sim', id)
  assert.doesNotMatch(pecarnMaior2.calcular(com(pecarnMaior2, 'vomitos'))!.derivados[1][1], /3 meses/)
  assert.match(String(item(pecarnMaior2, 'mecanismo').ajuda), /1,5 m/)
  const r = com(pecarnMaior2)
  delete r.cefaleia
  assert.equal(pecarnMaior2.calcular(r), null)
})

test('glasgow pediátrico: total e gravidade (Tabela 1, p. 172)', () => {
  const idx = (id: string, valor: number) => item(glasgowPediatrico, id).opcoes.findIndex((o) => o.valor === valor)
  const r = (o: number, v: number, m: number) => glasgowPediatrico.calcular({ ocular: idx('ocular', o), verbal: idx('verbal', v), motora: idx('motora', m) })!
  assert.equal(r(4, 5, 6).valor, '15')
  assert.match(r(4, 5, 6).nota, /leve/)
  assert.match(r(3, 4, 5).nota, /moderado/) // 12
  assert.match(r(2, 2, 4).nota, /grave/) // 8
  assert.match(item(glasgowPediatrico, 'verbal').opcoes[0].rotulo, /Balbucio/)
})

test('hiperosmolar (p. 179): NaCl 3% 2–5 mL/kg; manitol 20% 0,25–1 g/kg', () => {
  const d = (id: string) => calcularDose(DOSES_TCE.find((x) => x.id === id)!, 20)!
  assert.deepEqual(d('nacl3-bolus').dose, [40, 100])
  assert.deepEqual(d('nacl3-continuo').dose, [2, 20])
  assert.deepEqual(d('manitol').dose, [5, 20])
  assert.deepEqual(d('manitol').volumeMl, [25, 100])
})
