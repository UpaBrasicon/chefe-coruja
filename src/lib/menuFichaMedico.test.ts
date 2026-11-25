// node --experimental-strip-types --test src/lib/menuFichaMedico.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { itensDeNavegacao, menuMedicoCelular } from '../components/casca/navegacao.ts'

// B-08 (decisão do RT de 25/11/2026): só a recepção abre ficha e, na
// emergência, o médico. O menu do Médico ganha o caminho para a mesma tela.
test('o médico tem Nova ficha no menu, logo depois de Atendimento', () => {
  const itens = itensDeNavegacao('plantonista', false, false, 'upa')
  const i = itens.findIndex((x) => x.to === '/recepcao')
  assert.ok(i > 0, 'médico sem Nova ficha')
  assert.equal(itens[i].rotulo, 'Nova ficha')
  assert.equal(itens[i - 1].to, '/atendimento')
  assert.ok(menuMedicoCelular(itens, 'upa').some((x) => x.to === '/recepcao'), 'no celular, a Nova ficha fica no Menu')
})

test('na UBS a ficha segue só com a recepção', () => {
  assert.ok(!itensDeNavegacao('plantonista', false, false, 'ubs').some((x) => x.to === '/recepcao'))
  assert.ok(itensDeNavegacao('recepcao', false, false, 'ubs').some((x) => x.to === '/recepcao'))
})

test('quem não abre ficha não ganha o item', () => {
  for (const papel of ['tecnico_enfermagem', 'enfermeiro', 'farmaceutico', 'nir', 'gestor', 'regulador'] as const) {
    assert.ok(!itensDeNavegacao(papel, false, false, 'upa').some((x) => x.to === '/recepcao'), `${papel} vê Nova ficha`)
  }
})
