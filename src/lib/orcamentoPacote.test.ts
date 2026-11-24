// node --experimental-strip-types --test src/lib/orcamentoPacote.test.ts
//
// F1 da trilha Desempenho: orçamento do JavaScript inicial no CI. O JS
// inicial cresceu de 342 KB (09/11) para 358 KB (23/11) em gzip sem ninguém
// ver; agora o CI mede e avisa acima de +5% sobre a linha de base.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'

import { avaliarOrcamento, FOLGA_PADRAO, jsIniciais } from './orcamentoPacote.ts'

const HTML = `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/index-a.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-react-b.js">
<link rel="stylesheet" crossorigin href="/assets/index-c.css">
<link rel="modulepreload" crossorigin href="/assets/Login-d.js">
<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/geist-e.woff2">
<link rel="prefetch" crossorigin href="/assets/AppShell-f.js">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-react-b.js">
</head><body><div id="root"></div></body></html>`

test('soma script e modulepreload; ignora CSS, fonte, prefetch, terceiros e repetidos', () => {
  assert.deepEqual(jsIniciais(HTML), ['assets/index-a.js', 'assets/vendor-react-b.js', 'assets/Login-d.js'])
})

test('o orçamento passa até +5% e não passa acima', () => {
  assert.equal(FOLGA_PADRAO, 0.05)
  assert.equal(avaliarOrcamento(105_000, 100_000).passou, true)
  const acima = avaliarOrcamento(105_001, 100_000)
  assert.equal(acima.passou, false)
  assert.equal(acima.limite, 105_000)
  assert.ok(Math.abs(acima.variacao - 0.05001) < 1e-9)
  assert.throws(() => avaliarOrcamento(1, 0))
})

test('o script soma os .js em gzip de um dist falso, avisa acima do teto e só falha com --falhar', () => {
  const dist = mkdtempSync(join(tmpdir(), 'orcamento-'))
  try {
    mkdirSync(join(dist, 'assets'))
    writeFileSync(join(dist, 'index.html'), HTML)
    const conteudo = { 'index-a.js': 'a'.repeat(5000), 'vendor-react-b.js': 'console.log(1)\n'.repeat(300), 'Login-d.js': 'x', 'AppShell-f.js': 'z'.repeat(9000) }
    for (const [f, s] of Object.entries(conteudo)) writeFileSync(join(dist, 'assets', f), s)
    writeFileSync(join(dist, 'assets', 'index-c.css'), 'body{}')
    const esperado = ['index-a.js', 'vendor-react-b.js', 'Login-d.js']
      .reduce((s, f) => s + gzipSync(readFileSync(join(dist, 'assets', f))).length, 0)

    const rodar = (...extra: string[]) =>
      spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/orcamento-pacote.mjs', dist, ...extra], { encoding: 'utf8' })

    const so = rodar()
    assert.equal(so.status, 0, so.stderr)
    assert.match(so.stdout, new RegExp(`3 arquivos, \\d+ bytes, ${esperado} em gzip`))

    const dentro = rodar('--base', String(esperado))
    assert.equal(dentro.status, 0)
    assert.match(dentro.stdout, /Dentro do orçamento/)

    const baixa = String(Math.floor(esperado / 1.2))
    const aviso = rodar('--base', baixa)
    assert.equal(aviso.status, 0, 'sem --falhar, só avisa')
    assert.match(aviso.stdout, /::warning::JavaScript inicial acima do orçamento/)

    const falha = rodar('--base', baixa, '--falhar')
    assert.equal(falha.status, 1)
    assert.match(falha.stderr, /::error::JavaScript inicial acima do orçamento/)
  } finally {
    rmSync(dist, { recursive: true, force: true })
  }
})

test('o CI roda o orçamento logo depois do build', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
  const build = ci.indexOf('npm run build')
  const passo = ci.indexOf('scripts/orcamento-pacote.mjs dist --base')
  assert.ok(build > 0 && passo > build, 'falta o passo do orçamento depois do build no ci.yml')
})
