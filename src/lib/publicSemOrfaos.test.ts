import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Pedido 11 do diagnóstico de desempenho (F9): `public/` guardava arquivos que
// nada usava (icons.svg, login-img-1..4.svg, plantao/background.png e
// plantao/MODELO_EXAMES.png), publicados em toda versão. Todo arquivo de
// `public/` tem de ser citado, pelo caminho a partir da raiz do site, por quem
// chega ao navegador: o código de `src/` (sem contar os testes), o
// `index.html`, o service worker, o manifesto ou o `vercel.json`.
// Arquivo novo em `public/` sem uso faz este teste falhar: use ou apague.

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho]
  })
}

const CODIGO = /\.(ts|tsx|js|jsx|css)$/
const fontes = [
  ...arquivos('src').filter((f) => CODIGO.test(f) && !/\.test\.tsx?$/.test(f)),
  'index.html',
  'public/sw.js',
  'public/manifest.webmanifest',
  'vercel.json',
]
const texto = fontes.map((f) => readFileSync(f, 'utf8')).join('\n')

/** `/caminho` citado inteiro (sem continuar em outro nome, como logo.png em logo.png.bak). */
const citado = (rota: string) => new RegExp(`${rota.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`).test(texto)

const publicos = arquivos('public').map((f) => '/' + relative('public', f).split(sep).join('/'))

test('public/ tem arquivos (a busca não está vazia)', () => {
  assert.ok(publicos.length >= 5, publicos.join(', '))
})

test('todo arquivo de public/ é usado pelo app', () => {
  const orfaos = publicos.filter((rota) => !citado(rota))
  assert.deepEqual(orfaos, [], `sem uso em src/, index.html, sw.js, manifesto ou vercel.json: ${orfaos.join(', ')}`)
})
