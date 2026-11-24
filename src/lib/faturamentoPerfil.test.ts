// node --experimental-strip-types --test src/lib/faturamentoPerfil.test.ts
// Revisão do perfil Faturamento (RT, 24/11/2026): o menu na ordem do trabalho
// (FT1) e o aviso do ERP que diz quem resolve (CT3).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { agruparNavegacao, inicioDoPapel, itensDeNavegacao } from '../components/casca/navegacao.ts'
import { podeAbrirIntegracoes, QUEM_ATIVA_CHAVE_ERP, semChaveErp } from './erpLigacao.ts'

test('FT1: menu do faturamento na ordem do trabalho, com Produção e Cadastro', () => {
  const itens = itensDeNavegacao('faturamento', false, false, 'upa')
  assert.deepEqual(itens.map((i) => i.to), ['/faturamento/contas', '/faturamento', '/apac', '/faturamento/glosas', '/faturamento/erp', '/faturamento/materiais', '/minha-escala'])
  assert.deepEqual(agruparNavegacao(itens).map((b) => b.grupo ?? b.itens[0].rotulo),
    ['Contas', 'Produção', 'Glosas', 'ERP', 'Cadastro', 'Escala'])
  assert.equal(inicioDoPapel('faturamento', 'upa'), '/faturamento/contas')
})

test('FT1: a AIH fica fora até o banco abrir aihs_da_unidade ao faturamento', () => {
  assert.ok(!itensDeNavegacao('faturamento', false, false, 'upa').some((i) => i.to === '/aih'))
})

test('CT3: o aviso diz quem resolve e o caminho só para quem abre Integrações', () => {
  assert.equal(QUEM_ATIVA_CHAVE_ERP, 'O administrador ativa a chave do ERP em Integrações.')
  assert.equal(podeAbrirIntegracoes('faturamento'), false)
  assert.equal(podeAbrirIntegracoes('gestor'), true)
  assert.equal(podeAbrirIntegracoes('admin'), true)
  assert.equal(podeAbrirIntegracoes(null), false)
  assert.match(semChaveErp(2), /revogadas ou venceram/)
  assert.match(semChaveErp(0), /recurso Financeiro/)
})
