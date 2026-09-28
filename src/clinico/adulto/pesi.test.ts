import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { classePesi, pesi } from './pesi.ts'

const zeros = { idade: 40, sexo: 0, neoplasia: 0, icc: 0, dpoc: 0, fc: 0, pas: 0, fr: 0, temp: 0, consciencia: 0, sat: 0 }
const idx = (id: string, sim: boolean) => {
  const item = pesi.itens.find((i) => i.id === id)
  assert.ok(item && item.tipo === 'escolha')
  return sim ? 1 : 0
}

test('PESI: ficha de adulto do manual do HC', () => {
  assert.equal(pesi.ficha.id, 'adulto-pesi')
  assert.equal(pesi.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(pesi.ficha), false)
  assert.match(pesi.ficha.fontes[0].citacao, /p\. 445–447/)
})

test('PESI: pontos exatos da Tabela 10 (p. 446)', () => {
  const pontos: Record<string, number> = { sexo: 10, neoplasia: 30, icc: 10, dpoc: 10, fc: 20, pas: 30, fr: 20, temp: 20, consciencia: 60, sat: 20 }
  for (const [id, p] of Object.entries(pontos)) {
    const res = pesi.calcular({ ...zeros, [id]: idx(id, true) })!
    assert.equal(res.valor, String(40 + p), id)
  }
  const fr = pesi.itens.find((i) => i.id === 'fr')!
  assert.match(fr.rotulo, /> 30/)
  assert.doesNotMatch(fr.rotulo, /≥/)
})

test('PESI: idade soma em anos; falta de resposta devolve null', () => {
  assert.equal(pesi.calcular({ ...zeros, idade: undefined }), null)
  assert.equal(pesi.calcular({ ...zeros, sat: undefined }), null)
  assert.equal(pesi.calcular({ ...zeros, idade: 77 })!.valor, '77')
})

test('PESI: classes I ≤ 65, II 66-85, III 86-105, IV 106-125, V > 125', () => {
  assert.equal(classePesi(65).classe, 'I')
  assert.equal(classePesi(66).classe, 'II')
  assert.equal(classePesi(85).classe, 'II')
  assert.equal(classePesi(86).classe, 'III')
  assert.equal(classePesi(105).classe, 'III')
  assert.equal(classePesi(106).classe, 'IV')
  assert.equal(classePesi(125).classe, 'IV')
  assert.equal(classePesi(126).classe, 'V')
  assert.equal(pesi.calcular({ ...zeros, idade: 65 })!.estado, 0)
  assert.equal(pesi.calcular({ ...zeros, idade: 90 })!.estado, 1)
  assert.equal(pesi.calcular({ ...zeros, idade: 70, consciencia: 1 })!.estado, 2)
})

test('PESI: sem sPESI e sem mortalidade', () => {
  const res = pesi.calcular({ ...zeros, idade: 90, pas: 1 })!
  const texto = JSON.stringify(res)
  assert.doesNotMatch(texto, /mortalidade ~|%/)
  assert.doesNotMatch(JSON.stringify(pesi.itens), /sPESI/)
  const v = pesi.calcular({ ...zeros, idade: 70, consciencia: 1 })!
  assert.match(JSON.stringify(v.derivados), /não descreve conduta para a classe V/)
})
