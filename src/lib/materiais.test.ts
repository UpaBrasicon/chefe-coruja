import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { GRUPO_PENDENCIA, lerQuantidade, ondeCorrigir, EVENTO, type MaterialUnidade } from './contas.ts'
import { filtrarMateriais } from './materiais.ts'
import { itensDeNavegacao } from '../components/casca/navegacao.ts'

// Pendências da 5B, L4 (decisão L4 = A e opção A da tela, RT em 05/11/2026):
// materiais lançados à mão na conta, sem valor e sem estoque.

test('quantidade: maior que zero, até 2 casas, aceita vírgula', () => {
  assert.equal(lerQuantidade('3'), 3)
  assert.equal(lerQuantidade('1,5'), 1.5)
  assert.equal(lerQuantidade(' 2.25 '), 2.25)
  for (const t of ['0', '-1', '1,555', 'abc', '', '1e3']) assert.equal(lerQuantidade(t), null, t)
})

test('busca do cadastro: nome sem acento, código SIGTAP e situação', () => {
  const m = (nome: string, ativo: boolean, procedimento: string | null = null): MaterialUnidade =>
    ({ id: nome, nome, unidade_consumo: 'unidade', procedimento, procedimento_nome: null, ativo, lancamentos: 0 })
  const lista = [m('Gaze estéril', true), m('Fio de sutura', true, '0702050000'), m('Atadura', false)]
  assert.deepEqual(filtrarMateriais(lista, 'esteril', true).map((x) => x.nome), ['Gaze estéril'])
  assert.deepEqual(filtrarMateriais(lista, '0702', true).map((x) => x.nome), ['Fio de sutura'])
  assert.deepEqual(filtrarMateriais(lista, '', false).map((x) => x.nome), ['Atadura'])
  assert.deepEqual(filtrarMateriais(lista, '', true).length, 2)
})

test('pendência do grupo "material" aparece na conta e diz onde corrigir', () => {
  assert.equal(GRUPO_PENDENCIA.material, 'Material')
  assert.match(ondeCorrigir({ grupo: 'material', codigo: 'material_sem_sigtap' }, 'ambulatorial'), /Materiais/)
  assert.equal(EVENTO.material_lancado, 'Material lançado')
  assert.equal(EVENTO.material_retirado, 'Material retirado')
})

test('a tela de materiais é do faturamento e do gestor', () => {
  assert.ok(itensDeNavegacao('faturamento', false, false, 'upa').some((i) => i.to === '/faturamento/materiais'))
  assert.ok(itensDeNavegacao('gestor', false, false, 'upa').some((i) => i.to === '/faturamento/materiais'))
  assert.ok(!itensDeNavegacao('recepcao', false, false, 'upa').some((i) => i.to === '/faturamento/materiais'))
  assert.match(readFileSync('src/App.tsx', 'utf8'), /path="\/faturamento\/materiais"/)
})

test('as telas usam as RPCs da migration 20270226000001', () => {
  const pagina = readFileSync('src/pages/faturamento/Materiais.tsx', 'utf8')
  assert.match(pagina, /rpc\('materiais_da_unidade'/)
  assert.match(pagina, /rpc\('material_salvar'/)
  const conta = readFileSync('src/pages/faturamento/Contas.tsx', 'utf8')
  assert.match(conta, /rpc\('conta_lancar_material'/)
  assert.match(conta, /rpc\('conta_retirar_material'/)
  assert.match(conta, /<MateriaisConta /)
})
