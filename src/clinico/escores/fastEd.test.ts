// node --experimental-strip-types --test src/clinico/escores/fastEd.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Respostas } from '../escore.ts'
import { fastEd } from './fastEd.ts'

// Índice da opção por item (Tabela 1 do Lima 2016).
const r = (face: number, braco: number, fala: number, olhar: number, negligencia: number): Respostas => ({ face, braco, fala, olhar, negligencia })

test('FAST-ED: incompleto não calcula', () => {
  assert.equal(fastEd.calcular({ face: 0 }), null)
})
test('FAST-ED: pontos da Tabela 1 (face 0–1; braço, fala, olhar e negligência 0–2; máximo 9)', () => {
  assert.deepEqual(fastEd.itens.map((i) => (i.tipo === 'escolha' ? i.opcoes.map((o) => o.valor) : [])), [[0, 1], [0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2]])
  assert.equal(fastEd.calcular(r(0, 0, 0, 0, 0))!.valor, '0')
  assert.equal(fastEd.calcular(r(1, 2, 2, 2, 2))!.valor, '9')
})
test('FAST-ED: faixas 0–1, 2–3 e 4 ou mais', () => {
  const baixo = fastEd.calcular(r(1, 0, 0, 0, 0))!
  assert.match(baixo.nota, /menos de 15%/)
  assert.equal(baixo.estado, 0)
  const meio = fastEd.calcular(r(1, 1, 1, 0, 0))!
  assert.equal(meio.valor, '3')
  assert.match(meio.nota, /cerca de 30%/)
  assert.equal(meio.estado, 1)
  const alto = fastEd.calcular(r(0, 2, 0, 2, 0))!
  assert.equal(alto.valor, '4')
  assert.match(alto.nota, /60%/)
  assert.equal(alto.estado, 2)
  assert.ok(alto.alerta)
})
test('FAST-ED: avisa que não substitui a angiotomografia e que o tempo não pontua', () => {
  const c = fastEd.calcular(r(0, 0, 0, 0, 0))!.cuidados.join(' ')
  assert.match(c, /angiotomografia/)
  assert.match(c, /não pontua/)
})
test('FAST-ED: ficha de adulto com a fonte do Lima 2016', () => {
  assert.equal(fastEd.ficha.publico, 'adulto')
  assert.match(fastEd.ficha.fontes[0].citacao, /PMID 27364531/)
})
