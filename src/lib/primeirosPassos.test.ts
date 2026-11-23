// Fase 1, item 13: primeiros passos por papel (OB1–OB4 = A do RT, 23/11/2026).
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('cada guia leva a telas que estão no menu do app', async () => {
  const { GUIAS } = await import('../domain/primeirosPassos.ts')
  const nav = readFileSync('src/components/casca/navegacao.ts', 'utf8')
  for (const [papel, g] of Object.entries(GUIAS)) {
    assert.ok(g.passos.length >= 4, papel)
    for (const p of g.passos) assert.ok(nav.includes(`to: '${p.to}'`), `${papel}: ${p.to}`)
  }
})

test('o guia só mostra tarefas do menu da unidade; sem nenhuma, não há cartão', async () => {
  const { guiaDoPapel } = await import('../domain/primeirosPassos.ts')
  const upa = guiaDoPapel('recepcao', ['/recepcao', '/recepcao/fila-triagem', '/recepcao/fila-medica', '/recepcao/painel'])
  assert.deepEqual(upa?.passos.map((p) => p.id), ['ficha', 'triagem', 'medica', 'painel'])
  assert.equal(guiaDoPapel('recepcao', ['/outra']), null)
  assert.equal(guiaDoPapel('admin', ['/recepcao']), null)
  assert.equal(guiaDoPapel(null, ['/recepcao']), null)
})

test('o cartão some ao esconder ou ao fazer tudo; leitura tolera lixo', async () => {
  const { guiaDoPapel, mostrarCartao, lerProgresso, chaveProgresso } = await import('../domain/primeirosPassos.ts')
  const g = guiaDoPapel('farmaceutico', ['/farmacia', '/dispensacao', '/alta-vigilancia', '/interacoes'])!
  assert.equal(mostrarCartao(g, { feitos: [], escondido: false }), true)
  assert.equal(mostrarCartao(g, { feitos: [], escondido: true }), false)
  assert.equal(mostrarCartao(g, { feitos: g.passos.map((p) => p.id), escondido: false }), false)
  assert.deepEqual(lerProgresso('{"feitos":["a",1],"escondido":"sim"}'), { feitos: ['a'], escondido: false })
  assert.deepEqual(lerProgresso('não é json'), { feitos: [], escondido: false })
  assert.equal(chaveProgresso('p1', 'recepcao'), 'cc-primeiros-passos:p1:recepcao')
})

test('a casca mostra o cartão só na tela inicial e o menu reabre', () => {
  const shell = readFileSync('src/components/AppShell.tsx', 'utf8')
  assert.match(shell, /location\.pathname === inicio && <PrimeirosPassos /)
  const menu = readFileSync('src/components/casca/MenuUsuario.tsx', 'utf8')
  assert.match(menu, /reabrirPrimeirosPassos\(primeirosPassos\.perfilId!, papelAtivo\)/)
  assert.ok(readdirSync('docs/implantacao/treinamento').length >= 6, 'os roteiros de treinamento são a fonte do texto')
})
