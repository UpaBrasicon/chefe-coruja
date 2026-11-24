// node --experimental-strip-types --test src/lib/travasAlta.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agruparTravas, rotuloDarAlta, tituloGrupo } from './travasAlta.ts'

test('nove exames sem resultado viram um grupo com os ids', () => {
  const lista = Array.from({ length: 9 }, (_, k) => ({ tipo: 'exame', id: `e${k}`, descricao: `Exame sem resultado: Exame ${k}` }))
  const g = agruparTravas([...lista, { tipo: 'agravo', id: 'a1', descricao: 'Agravo suspeito sem notificação registrada: dengue' }])
  assert.equal(g.length, 2)
  assert.equal(tituloGrupo(g[0]), '9 exames sem resultado')
  assert.equal(g[0].ids.length, 9)
  assert.equal(tituloGrupo(g[1]), '1 agravo suspeito sem notificação')
  assert.equal(rotuloDarAlta(g), 'Dar alta (2 pendências)')
})

test('texto sem dois-pontos é o próprio título; strings também servem', () => {
  const g = agruparTravas(['Passagem de plantão aguardando aceite', 'Exame sem resultado: PCR', 'Exame sem resultado: TGO'])
  assert.equal(g[0].titulo, 'Passagem de plantão aguardando aceite')
  assert.deepEqual(g[1].itens, ['PCR', 'TGO'])
  assert.equal(rotuloDarAlta([]), 'Dar alta')
})
