// node --experimental-strip-types --test src/clinico/escores/race.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Respostas } from '../escore.ts'
import { race } from './race.ts'

// Índice da opção por item (Tabela 1 do Pérez de la Ossa 2014).
const r = (face: number, braco: number, perna: number, olhar: number, cortical: number): Respostas => ({ face, braco, perna, olhar, cortical })

test('RACE: incompleto não calcula', () => {
  assert.equal(race.calcular({ face: 0 }), null)
})
test('RACE: pontos da Tabela 1 (face, braço, perna e afasia/agnosia 0–2; olhar 0–1; máximo 9)', () => {
  assert.deepEqual(race.itens.map((i) => (i.tipo === 'escolha' ? i.opcoes.map((o) => o.valor) : [])), [[0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1], [0, 1, 2]])
  assert.equal(race.calcular(r(0, 0, 0, 0, 0))!.valor, '0')
  assert.equal(race.calcular(r(2, 2, 2, 1, 2))!.valor, '9')
})
test('RACE: corte de 5 da Tabela 3 (sensibilidade 0,85, especificidade 0,68, VPP 0,42, VPN 0,94)', () => {
  const quatro = race.calcular(r(1, 1, 1, 1, 0))!
  assert.equal(quatro.valor, '4')
  assert.equal(quatro.estado, 0)
  assert.ok(!quatro.alerta)
  assert.deepEqual(quatro.derivados[1], ['Corte de 4 ou mais no estudo', 'sensibilidade 0,89 · especificidade 0,55 · VPP 0,35 · VPN 0,95'])
  const cinco = race.calcular(r(2, 1, 1, 1, 0))!
  assert.equal(cinco.valor, '5')
  assert.equal(cinco.estado, 2)
  assert.ok(cinco.alerta)
  assert.deepEqual(cinco.derivados, [['Corte de 5 ou mais no estudo (o melhor)', 'sensibilidade 0,85 · especificidade 0,68 · VPP 0,42 · VPN 0,94']])
})
test('RACE: avisa que não substitui a angiotomografia e que o hemorrágico também pontua alto', () => {
  const c = race.calcular(r(0, 0, 0, 0, 0))!.cuidados.join(' ')
  assert.match(c, /angiotomografia/)
  assert.match(c, /hemorrágico/)
})
test('RACE: ficha de adulto com a fonte do Pérez de la Ossa 2014', () => {
  assert.equal(race.ficha.publico, 'adulto')
  assert.match(race.ficha.fontes[0].citacao, /Stroke\. 2014;45\(1\):87–91/)
  assert.equal(race.ficha.fontes[0].url, 'https://doi.org/10.1161/STROKEAHA.113.003071')
})
