// Contraste da plataforma, CT4 = A (RT, 23/11/2026): abas com linha de base
// visível e a ativa com fundo destacado.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('CT4: linha de base fio-forte e aba ativa com fundo, sublinhado e texto na cor da ação', () => {
  const c = readFileSync('src/components/ui/tabs.tsx', 'utf8')
  assert.match(c, /border-b border-fio-forte text-tinta-sussurro/)
  assert.match(c, /data-active:border-acao data-active:bg-alerta-marca data-active:font-semibold data-active:text-acao/)
  assert.match(c, /rounded-t-controle border-b-2 border-transparent px-3/)
})
