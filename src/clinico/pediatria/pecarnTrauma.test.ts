// node --experimental-strip-types --test src/clinico/pediatria/pecarnTrauma.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Escore, Respostas } from '../escore.ts'
import { temReferenciaPediatrica } from '../ficha.ts'
import { pecarnAbdome, pecarnCervical } from './pecarnTrauma.ts'

const com = (e: Escore, ...ids: string[]): Respostas => Object.fromEntries(e.itens.map((i) => [i.id, ids.includes(i.id) ? 1 : 0]))

test('pecarn cervical: nenhum fator = sem fator de risco (liberação clínica no estudo)', () => {
  const r = pecarnCervical.calcular(com(pecarnCervical))!
  assert.equal(r.valor, 'Sem fator de risco')
  assert.match(r.nota, /liberação clínica/)
})
test('pecarn cervical: só fator não desprezível = radiografia no estudo', () => {
  const r = pecarnCervical.calcular(com(pecarnCervical, 'linhaMedia'))!
  assert.equal(r.valor, 'Risco não desprezível')
  assert.match(r.nota, /radiografia/)
})
test('pecarn cervical: qualquer alto risco vence = tomografia no estudo', () => {
  const r = pecarnCervical.calcular(com(pecarnCervical, 'deficit', 'dorCervical'))!
  assert.equal(r.valor, 'Alto risco')
  assert.equal(r.estado, 2)
})
test('pecarn abdome: sete ausentes = risco muito baixo; um presente = não desprezível', () => {
  assert.equal(pecarnAbdome.calcular(com(pecarnAbdome))!.valor, 'Risco muito baixo')
  assert.equal(pecarnAbdome.calcular(com(pecarnAbdome, 'vomitos'))!.valor, 'Risco não desprezível')
})
test('pecarn: fichas pediátricas com fonte pediátrica', () => {
  assert.equal(temReferenciaPediatrica(pecarnCervical.ficha), true)
  assert.equal(temReferenciaPediatrica(pecarnAbdome.ficha), true)
})
