// node --experimental-strip-types --test src/clinico/escores/sofa2.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { sofa2 } from './sofa2.ts'

/** Índice da opção = pontos (0 a 4) em todos os sistemas. */
const r = (cerebro: number, resp: number, cv: number, figado: number, rim: number, hemostasia: number): Respostas => ({ cerebro, resp, cv, figado, rim, hemostasia })

test('SOFA-2: seis sistemas de 0 a 4, total de 0 a 24 (Tabela 2)', () => {
  assert.equal(sofa2.itens.length, 6)
  for (const i of sofa2.itens) assert.deepEqual(i.tipo === 'escolha' && i.opcoes.map((o) => o.valor), [0, 1, 2, 3, 4], i.id)
  assert.equal(sofa2.calcular(r(0, 0, 0, 0, 0, 0))!.valor, '0')
  assert.equal(sofa2.calcular(r(4, 4, 4, 4, 4, 4))!.valor, '24')
})
test('SOFA-2: soma e contagem de sistemas', () => {
  const res = sofa2.calcular(r(1, 3, 2, 0, 0, 4))!
  assert.equal(res.valor, '10')
  assert.equal(res.nota, '4 de 6 sistemas com pontos')
  assert.deepEqual(res.derivados[0], ['Sistemas com 3 ou 4 pontos', '2 de 6'])
})
test('SOFA-2: sem corte de gravidade no artigo, faixa neutra', () => {
  assert.equal(sofa2.calcular(r(4, 4, 4, 4, 4, 4))!.estado, 0)
})
test('SOFA-2: incompleto devolve null', () => {
  const x = r(0, 0, 0, 0, 0, 0)
  delete x.rim
  assert.equal(sofa2.calcular(x), null)
})
test('SOFA-2: ficha de adulto, só a fonte primária', () => {
  assert.equal(sofa2.ficha.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(sofa2.ficha), false)
  assert.match(sofa2.ficha.fontes[0].citacao, /JAMA\. 2025;334\(23\):2090–2103/)
})
