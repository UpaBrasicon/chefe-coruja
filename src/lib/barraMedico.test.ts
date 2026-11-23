import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BARRA_MEDICO_CELULAR, ROTA_PERGUNTAR_IA, barraMedicoCelular, itensDeNavegacao, menuMedicoCelular } from '../components/casca/navegacao.ts'

// Barra de baixo do médico abaixo de 1024px (item 6; CM1 = A, RT em 23/11/2026).

test('cinco lugares: Início, Leitos, Perguntar à IA no meio, Prontuários e Menu', () => {
  assert.deepEqual(barraMedicoCelular().map((i) => i.rotulo), ['Início', 'Leitos', 'Perguntar à IA', 'Prontuários'])
  assert.equal(barraMedicoCelular()[2].to, ROTA_PERGUNTAR_IA)
  assert.equal(ROTA_PERGUNTAR_IA, '/plantonista?todas=1&ia=1')
  assert.equal(BARRA_MEDICO_CELULAR.length, 5)
})

test('a Agenda e as telas fora da barra vão para o Menu, sem repetir o que está na barra', () => {
  const itens = itensDeNavegacao('plantonista', false, false, null)
  const menu = menuMedicoCelular(itens, null)
  assert.ok(menu.some((i) => i.to === '/agenda'), 'agenda no menu')
  const naBarra = barraMedicoCelular().map((i) => i.to.split('?')[0])
  assert.ok(menu.every((i) => !naBarra.includes(i.to)))
  assert.equal(new Set(menu.map((i) => i.to)).size, menu.length)
})
