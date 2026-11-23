// Contraste da plataforma, CT1 = A (RT, 23/11/2026): fundo da página mais
// escuro que o cartão; o Card tem borda fio-forte.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('CT1: token pagina nos dois temas e a casca usa bg-pagina', () => {
  const css = readFileSync('src/index.css', 'utf8')
  assert.deepEqual([...css.matchAll(/--cc-pagina: (#[0-9A-Fa-f]{6});/g)].map((m) => m[1]), ['#EEF2F6', '#0F172A'])
  assert.match(css, /--color-pagina: var\(--cc-pagina\);/)
  const shell = readFileSync('src/components/AppShell.tsx', 'utf8')
  assert.match(shell, /cn\('cc-shell min-h-dvh bg-pagina md:flex'/)
  assert.doesNotMatch(shell, /cc-shell min-h-dvh bg-campo/)
})

test('CT1: o Card tem borda fio-forte', () => {
  assert.match(readFileSync('src/components/ui/card.tsx', 'utf8'), /rounded-cartao border border-fio-forte/)
})
