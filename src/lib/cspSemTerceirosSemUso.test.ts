import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Pedido 7 do diagnóstico de desempenho (F6): a CSP liberava o Google Fonts
// (fonts.googleapis.com no style-src e fonts.gstatic.com no font-src), mas o app
// não usa: a fonte vem do pacote @fontsource-variable/geist, servida pelo próprio
// site. Terceiro liberado sem uso só abre porta. Se um dia voltar a usar Google
// Fonts, este teste falha nos dois lados: libere na CSP e explique no PR.
type Regra = { source: string; headers: { key: string; value: string }[] }
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: Regra[] }
const csps = vercel.headers.flatMap((r) =>
  r.headers.filter((h) => h.key.toLowerCase() === 'content-security-policy').map((h) => ({ fonte: r.source, valor: h.value })),
)
const diretiva = (csp: string, nome: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${nome} `)) ?? ''

const GOOGLE_FONTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

test('as duas CSPs do vercel.json existem e são iguais', () => {
  assert.equal(csps.length, 2)
  assert.equal(csps[0].valor, csps[1].valor)
})

test('CSP não libera o Google Fonts', () => {
  for (const { fonte, valor } of csps) {
    for (const dominio of GOOGLE_FONTS) {
      assert.ok(!valor.includes(dominio), `${fonte}: a CSP ainda libera ${dominio}`)
    }
  }
})

test('CSP mantém as fontes do próprio site (Geist via @fontsource)', () => {
  for (const { fonte, valor } of csps) {
    assert.equal(diretiva(valor, 'font-src'), "font-src 'self' data:", fonte)
    assert.equal(diretiva(valor, 'style-src'), "style-src 'self' 'unsafe-inline'", fonte)
  }
})

// Arquivos de texto que chegam ao navegador do app: o código (src/), a casca
// (index.html) e o que é servido sem passar pelo Vite (public/).
const TEXTO = /\.(ts|tsx|js|jsx|mjs|css|html|json|webmanifest|svg)$/
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return TEXTO.test(nome) ? [caminho] : []
  })
}

test('nada em src/, public/ ou index.html usa o Google Fonts', () => {
  const este = join('src', 'lib', 'cspSemTerceirosSemUso.test.ts')
  const usos = ['index.html', ...arquivos('src'), ...arquivos('public')]
    .filter((f) => f !== este)
    .filter((f) => GOOGLE_FONTS.some((d) => readFileSync(f, 'utf8').includes(d)))
  assert.deepEqual(usos, [])
})
