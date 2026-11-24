import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 24 do kit de desempenho (docs/desempenho/AUDITORIA.md): a tela pede só
// as colunas que usa. Esta guarda impede um select('*') ou select('*, …') novo no app.
//
// Exceção única, de propósito: o perfil de quem entrou (AuthContext). É uma
// linha só, e o tipo Perfis['Row'] circula pelo app inteiro e pelo modo sem
// conexão (perfil guardado na aba).
const EXCECOES = new Set(['src/contexts/AuthContext.tsx'])

function arquivos(dir: string): string[] {
  const saida: string[] = []
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho))
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\./.test(nome)) saida.push(caminho.split('\\').join('/'))
  }
  return saida
}

// Pedido 27 (23/11/2026): a versão antiga só pegava select('*') exato, e três
// select('*, junção(...)') escaparam. Agora pega o '*' no começo da lista,
// sozinho ou seguido de vírgula, mesmo com a string na linha de baixo.
const ESTRELA = /\.select\(\s*['"`]\s*\*\s*(['"`]|,)/g

function achadosNoTexto(texto: string): number[] {
  const linhas: number[] = []
  for (const m of texto.matchAll(ESTRELA)) linhas.push(texto.slice(0, m.index).split('\n').length)
  return linhas
}

test('a guarda pega o * sozinho, com junção e com a string na linha de baixo', () => {
  assert.deepEqual(achadosNoTexto(".select('*')"), [1])
  assert.deepEqual(achadosNoTexto('.select("*, setores(nome)")'), [1])
  assert.deepEqual(achadosNoTexto('x\n  .select(\n    `*,pacientes(id)`)'), [2])
  assert.deepEqual(achadosNoTexto(".select('id, nome, setores(*)')"), [])
  assert.deepEqual(achadosNoTexto(".select('id, created_at')"), [])
})

test("nenhuma leitura do app usa select('*') nem select('*, …') fora da exceção do perfil", () => {
  const achados: string[] = []
  for (const f of arquivos('src')) {
    if (EXCECOES.has(f)) continue
    for (const linha of achadosNoTexto(readFileSync(f, 'utf8'))) achados.push(`${f}:${linha}`)
  }
  assert.deepEqual(achados, [])
})

test('a exceção do perfil continua sendo a única e continua existindo', () => {
  const auth = readFileSync('src/contexts/AuthContext.tsx', 'utf8')
  assert.match(auth, /from\('perfis'\)[\s\S]{0,40}\.select\('\*'\)/)
})
