import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 05 do kit de desempenho, parte b (decisão do RT em 09/11/2026, A):
// listas administrativas em páginas de 20 a 50 com "ver mais". AIH e APAC da
// unidade chegavam inteiras à tela (a AIH ainda se atualiza a cada minuto).
for (const [arquivo, rpc] of [
  ['src/pages/regulacao/Aih.tsx', 'aihs_da_unidade_pagina'],
  ['src/pages/regulacao/Apac.tsx', 'apacs_da_unidade_pagina'],
] as const) {
  test(`${arquivo}: lê em páginas e tem "Ver mais"`, () => {
    const fonte = readFileSync(arquivo, 'utf8')
    assert.match(fonte, new RegExp(`rpc\\('${rpc}', \\{[^}]*p_limite: limite`))
    assert.match(fonte, /<VerMais\b/)
    assert.doesNotMatch(fonte, /rpc\('(aihs|apacs)_da_unidade',/)
  })
}

test('a página é de 50', () => {
  assert.match(readFileSync('src/components/ui/ver-mais.tsx', 'utf8'), /export const PAGINA = 50/)
})
