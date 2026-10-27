import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// O farmacêutico não pede acesso ao prontuário (RT, 27/10/2026): sem o item no
// menu (a paleta de busca e a barra do celular leem o mesmo menu) e sem as
// rotas. O banco recusa o pedido (migration 20270105000001).
const menu = readFileSync('src/components/casca/navegacao.ts', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')

function blocoDoPapel(papel: string): string {
  const inicio = menu.indexOf(`\n  ${papel}: [`)
  assert.ok(inicio >= 0, `papel ${papel} não achado no menu`)
  return menu.slice(inicio, menu.indexOf('\n  ],', inicio))
}

/** Os papéis do RequireRole que envolve a rota. */
function papeisDaRota(caminho: string): string[] {
  const rota = app.indexOf(`path="${caminho}"`)
  assert.ok(rota >= 0, `rota ${caminho} não achada`)
  const guarda = app.lastIndexOf('<RequireRole papeis={[', rota)
  const lista = app.slice(guarda, app.indexOf(']}', guarda))
  return [...lista.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

test('o menu do farmacêutico não tem Prontuários', () => {
  assert.doesNotMatch(blocoDoPapel('farmaceutico'), /ITEM_PRONTUARIOS|'\/prontuarios'/)
  assert.match(blocoDoPapel('plantonista'), /ITEM_PRONTUARIOS/)
})

test('as rotas de prontuário não aceitam o farmacêutico', () => {
  for (const caminho of ['/prontuarios', '/prontuarios/:pacienteId']) {
    const papeis = papeisDaRota(caminho)
    assert.ok(!papeis.includes('farmaceutico'), `${caminho} aceita o farmacêutico`)
    assert.ok(papeis.includes('plantonista'), `${caminho} perdeu o plantonista`)
  }
})
