import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 24 do kit de desempenho (docs/desempenho/AUDITORIA.md): a tela pede só
// as colunas que usa. Esta guarda impede um select('*') novo no app.
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

test("nenhuma leitura do app usa select('*') fora da exceção do perfil", () => {
  const achados: string[] = []
  for (const f of arquivos('src')) {
    if (EXCECOES.has(f)) continue
    const linhas = readFileSync(f, 'utf8').split('\n')
    linhas.forEach((l, i) => {
      if (/\.select\(\s*['"`]\*['"`]\s*\)/.test(l)) achados.push(`${f}:${i + 1}`)
    })
  }
  assert.deepEqual(achados, [])
})

test('a exceção do perfil continua sendo a única e continua existindo', () => {
  const auth = readFileSync('src/contexts/AuthContext.tsx', 'utf8')
  assert.match(auth, /from\('perfis'\)[\s\S]{0,40}\.select\('\*'\)/)
})
