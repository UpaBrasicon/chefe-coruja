import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { abasEstreitasPlantonista, inicioDoPapel, itensDeNavegacao } from '../components/casca/navegacao.ts'

// 5A, tarefa 1 (D3 do RT em 02/11/2026): numa UBS não há porta, leito,
// internação nem AIH; esses itens somem do menu. Numa UPA nada muda.
const FORA = ['/plantonista', '/plantao', '/contingencia', '/gestao/porta', '/gestao/intercorrencias', '/internacao',
  '/observacao', '/nir', '/aih', '/apac', '/triagem', '/enfermagem', '/enfermagem/pronto-socorro',
  '/enfermagem/internacao', '/recepcao/painel']
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

test('percurso da UBS (U5): menus por papel decididos pelo RT em 17/11/2026', () => {
  const rotas = (papel: Parameters<typeof itensDeNavegacao>[0], tipo: 'ubs' | 'upa') =>
    itensDeNavegacao(papel, false, false, tipo).map((i) => i.to)
  // R8 e R9: recepção sem Encaminhados e com a fila da enfermagem
  assert.ok(!rotas('recepcao', 'ubs').includes('/encaminhados'))
  assert.equal(itensDeNavegacao('recepcao', false, false, 'ubs').find((i) => i.to === '/recepcao/fila-triagem')?.rotulo, 'Fila da enfermagem')
  assert.equal(itensDeNavegacao('recepcao', false, false, 'upa').find((i) => i.to === '/recepcao/fila-triagem')?.rotulo, 'Fila da triagem')
  // E10: Alta vigilância sai do enfermeiro na UBS e fica com o farmacêutico
  assert.ok(!rotas('enfermeiro', 'ubs').includes('/alta-vigilancia'))
  assert.ok(rotas('enfermeiro', 'upa').includes('/alta-vigilancia'))
  assert.ok(rotas('farmaceutico', 'ubs').includes('/alta-vigilancia'))
  // D7 e D8: médico sem Pareceres e sem Notificação na UBS; telemedicina fica
  for (const to of ['/pareceres', '/notificacao-compulsoria']) {
    assert.ok(!rotas('plantonista', 'ubs').includes(to), `médico vê ${to} na UBS`)
    assert.ok(rotas('plantonista', 'upa').includes(to), `médico perdeu ${to} na UPA`)
  }
  assert.ok(rotas('plantonista', 'ubs').includes('/teleinterconsulta'))
  assert.ok(rotas('enfermeiro', 'ubs').includes('/notificacao-compulsoria'))
  // GE7: grupos do gestor com nome da UBS
  const gestor = itensDeNavegacao('gestor', false, false, 'ubs')
  assert.ok(!gestor.some((i) => i.grupo === 'Porta' || i.grupo === 'Leitos'))
  assert.equal(gestor.find((i) => i.to === '/cadastros-duplicados')?.grupo, 'Cadastro')
  assert.equal(gestor.find((i) => i.to === '/regulacao')?.grupo, 'Rede')
})

test('percurso da UBS (U5): itens de porta e leito somem das telas da UBS', () => {
  const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
  assert.match(janela, /\{!ubs && <Contencao /)
  assert.match(janela, /\{!ubs && <Intercorrencias /)
  const cartao = readFileSync('src/components/plantonista/central/CartaoTurno.tsx', 'utf8')
  assert.match(cartao, /\{!ubs && \(\s*<Link to="\/plantao\/internacao\/pacientes"/)
  assert.match(readFileSync('src/pages/plantonista/PlantonistaHome.tsx', 'utf8'), /ubs=\{unidadeAtiva\?\.unidade\.tipo === 'ubs'\}/)
  const painel = readFileSync('src/pages/gestor/PainelGestor.tsx', 'utf8')
  assert.match(painel, /PAINEIS_FORA_DA_UBS = new Set\(\['permanencia', 'internacoes', 'giro', 'porta'\]\)/)
  const recepcao = readFileSync('src/pages/recepcao/Recepcao.tsx', 'utf8')
  assert.match(recepcao, /rotulo: 'Fila da enfermagem'/)
  assert.match(recepcao, /filter\(\(e\) => e\.etapa !== 'triagem'\)/)
})
