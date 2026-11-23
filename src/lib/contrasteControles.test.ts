// Contraste da plataforma, CT2 = A (RT, 23/11/2026): borda de campo e de
// controle com 3:1 sobre o fundo (WCAG 2.2, 1.4.11), no tema claro e no escuro.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

function lum(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const razao = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

test('CT2: o token controle fecha 3:1 sobre a superfície nos dois temas', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const valores = [...css.matchAll(/--cc-controle: (#[0-9A-Fa-f]{6});/g)].map((m) => m[1])
  const superficies = [...css.matchAll(/--cc-superficie: (#[0-9A-Fa-f]{6});/g)].map((m) => m[1])
  assert.equal(valores.length, 2, 'claro e escuro')
  assert.ok(razao(valores[0], superficies[0]) >= 3, `claro: ${razao(valores[0], superficies[0]).toFixed(2)}`)
  assert.ok(razao(valores[1], superficies[1]) >= 3, `escuro: ${razao(valores[1], superficies[1]).toFixed(2)}`)
  assert.match(css, /--color-controle: var\(--cc-controle\);/)
})

test('CT2: campos, seleção e caixa de marcar usam a borda controle e fundo branco', () => {
  for (const arq of ['input', 'textarea', 'input-group', 'campo-selecao', 'select']) {
    const c = readFileSync(`src/components/ui/${arq}.tsx`, 'utf8')
    assert.match(c, /border border-controle bg-superficie/, arq)
  }
  assert.match(readFileSync('src/components/ui/caixa-marcar.tsx', 'utf8'), /'border-controle bg-superficie'/)
})
