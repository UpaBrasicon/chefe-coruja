import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { abasEstreitasPlantonista, inicioDoPapel, itensDeNavegacao } from '../components/casca/navegacao.ts'

// 5A, tarefa 1 (D3 do RT em 02/11/2026): numa UBS não há porta, leito,
// internação nem AIH; esses itens somem do menu. Numa UPA nada muda.
const FORA = ['/plantonista', '/plantao', '/contingencia', '/gestao/porta', '/gestao/intercorrencias', '/internacao',
  '/observacao', '/nir', '/aih', '/apac', '/triagem', '/enfermagem', '/enfermagem/pronto-socorro',
  '/enfermagem/internacao', '/recepcao/fila-triagem', '/recepcao/painel']
const PAPEIS = ['plantonista', 'gestor', 'enfermeiro', 'tecnico_enfermagem', 'recepcao', 'regulador', 'faturamento',
  'farmaceutico', 'nir', 'admin'] as const

test('numa UBS, nenhum papel vê porta, leito, internação, AIH ou APAC', () => {
  for (const papel of PAPEIS) {
    const rotas = itensDeNavegacao(papel, true, true, 'ubs').map((i) => i.to)
    for (const to of FORA) assert.ok(!rotas.includes(to), `${papel} ainda vê ${to}`)
  }
})

test('numa UBS ficam os itens que não dependem de porta ou leito', () => {
  const gestor = itensDeNavegacao('gestor', false, false, 'ubs').map((i) => i.to)
  for (const to of ['/gestao', '/unidade', '/escala', '/faturamento', '/regulacao', '/gestao/farmacia']) {
    assert.ok(gestor.includes(to), `gestor perdeu ${to}`)
  }
  assert.ok(itensDeNavegacao('enfermeiro', false, false, 'ubs').some((i) => i.to === '/notificacao-compulsoria'))
  assert.ok(itensDeNavegacao('recepcao', false, false, 'ubs').some((i) => i.to === '/recepcao'))
})

test('numa UPA e num hospital o menu não muda', () => {
  for (const papel of PAPEIS) {
    for (const tipo of ['upa', 'hospital'] as const) {
      assert.deepEqual(itensDeNavegacao(papel, true, true, tipo), itensDeNavegacao(papel, true, true))
    }
  }
})

test('a tela inicial numa UBS é um item que cabe nela', () => {
  assert.equal(inicioDoPapel('plantonista'), '/plantonista')
  for (const papel of PAPEIS) {
    assert.ok(!FORA.includes(inicioDoPapel(papel, 'ubs')), `${papel} começa em ${inicioDoPapel(papel, 'ubs')}`)
  }
  assert.ok(abasEstreitasPlantonista('ubs').every((a) => !a.to.startsWith('/plantao') && a.to !== '/plantonista'))
  assert.equal(abasEstreitasPlantonista().length, 4)
})

test('a casca e a tela inicial passam o tipo da unidade ao menu', () => {
  const casca = readFileSync('src/components/AppShell.tsx', 'utf8')
  assert.match(casca, /itensDeNavegacao\(papelAtivo, ehRt, ehSuperAdmin, tipoUnidade\)/)
  assert.match(casca, /abasEstreitasPlantonista\(tipoUnidade\)/)
  assert.match(readFileSync('src/routes/RedirectHome.tsx', 'utf8'), /foraDoTipo\(inicial, tipo\)/)
})

test('5A, parte 2.4: a escuta inicial só existe na UBS e é o começo do enfermeiro nela', () => {
  assert.ok(itensDeNavegacao('enfermeiro', false, false, 'ubs').some((i) => i.to === '/escuta'))
  for (const tipo of ['upa', 'hospital', null] as const) {
    assert.ok(!itensDeNavegacao('enfermeiro', false, false, tipo).some((i) => i.to === '/escuta'), `${tipo} vê a escuta`)
  }
  assert.equal(inicioDoPapel('enfermeiro', 'ubs'), '/escuta')
  assert.equal(inicioDoPapel('enfermeiro', 'upa'), '/triagem')
  assert.match(readFileSync('src/App.tsx', 'utf8'), /<Route path="\/escuta" element=\{<Triagem \/>\} \/>/)
})
