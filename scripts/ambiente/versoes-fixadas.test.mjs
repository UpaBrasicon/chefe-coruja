// Trilha de segurança, S9 (decisões V2, V3 e V4 do RT, 16/11/2026): nada do
// que vai para a produção muda de versão sozinho entre um deploy e outro.
// - V2: import externo das funções de borda (npm:, jsr:, https:) com versão
//   exata x.y.z, e cada pacote npm: registrado no supabase/functions/deno.lock
//   (o CI confere o lock com `deno cache --frozen`).
// - V3: toda ação do CI presa por SHA de commit (40 caracteres hexadecimais).
// - V4: nenhuma imagem de terceiro em `latest` nos docker-compose do repositório.
//   Imagens construídas aqui (rnds-envio) ficam de fora: a etiqueta é local.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('../../', import.meta.url))

function arquivos(dir, filtro, saida = []) {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '.git') continue
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, filtro, saida)
    else if (filtro(nome)) saida.push(caminho)
  }
  return saida
}

const rel = (p) => relative(RAIZ, p).replace(/\\/g, '/')
const EXATA = /@\d+\.\d+\.\d+(?:[-+][\w.]+)?(?:\/|$)/

/** Especificadores externos (npm:, jsr:, http(s):) de um arquivo TS. */
export function especificadoresExternos(texto) {
  const achados = []
  const re = /(?:from\s+|import\s*\(\s*|import\s+)['"]((?:npm:|jsr:|https?:\/\/)[^'"]+)['"]/g
  for (const m of texto.matchAll(re)) achados.push(m[1])
  return achados
}

test('V2: funções de borda importam pacotes externos com versão exata', () => {
  const ts = arquivos(join(RAIZ, 'supabase/functions'), (n) => n.endsWith('.ts'))
  assert.ok(ts.length > 0)
  const soltos = []
  for (const f of ts) {
    for (const esp of especificadoresExternos(readFileSync(f, 'utf8'))) {
      const semEsquema = esp.replace(/^(npm:|jsr:)/, '').replace(/^https?:\/\/[^/]+\//, '')
      if (!EXATA.test(semEsquema)) soltos.push(`${rel(f)}: ${esp}`)
      if (/esm\.sh|cdn\.skypack|unpkg\.com|jsdelivr/.test(esp)) soltos.push(`${rel(f)}: ${esp} (CDN de terceiro; use npm: com versão)`)
    }
  }
  assert.deepEqual(soltos, [], 'import sem versão exata ou por CDN')
})

test('V2: todo pacote npm: das funções está no deno.lock', () => {
  const lock = JSON.parse(readFileSync(join(RAIZ, 'supabase/functions/deno.lock'), 'utf8'))
  const registrados = new Set(Object.keys(lock.specifiers ?? {}))
  const faltam = new Set()
  for (const f of arquivos(join(RAIZ, 'supabase/functions'), (n) => n.endsWith('.ts'))) {
    for (const esp of especificadoresExternos(readFileSync(f, 'utf8'))) {
      if (esp.startsWith('npm:') && !registrados.has(esp)) faltam.add(esp)
    }
  }
  assert.deepEqual([...faltam], [], 'rode `deno cache --lock=deno.lock` em supabase/functions')
})

test('V3: ações do CI presas por SHA', () => {
  const dir = join(RAIZ, '.github/workflows')
  const soltas = []
  for (const f of arquivos(dir, (n) => /\.ya?ml$/.test(n))) {
    for (const [i, linha] of readFileSync(f, 'utf8').split('\n').entries()) {
      const m = linha.match(/^\s*-?\s*uses:\s*([^\s#]+)/)
      if (!m || m[1].startsWith('./')) continue
      if (!/@[0-9a-f]{40}$/.test(m[1])) soltas.push(`${rel(f)}:${i + 1}: ${m[1]}`)
    }
  }
  assert.deepEqual(soltas, [], 'use o SHA do commit com a versão em comentário')
})

test('V4: nenhuma imagem de terceiro em latest nos docker-compose', () => {
  const LOCAIS = new Set(['rnds-envio'])
  const composes = arquivos(RAIZ, (n) => /^docker-compose.*\.ya?ml$|^compose.*\.ya?ml$/.test(n))
  const latest = []
  for (const f of composes) {
    for (const [i, linha] of readFileSync(f, 'utf8').split('\n').entries()) {
      const m = linha.match(/^\s*image:\s*['"]?([^'"\s#]+)/)
      if (!m) continue
      const [nome, tag] = m[1].split(':')
      if (LOCAIS.has(nome)) continue
      if (!tag || tag === 'latest') latest.push(`${rel(f)}:${i + 1}: ${m[1]}`)
    }
  }
  assert.deepEqual(latest, [], 'fixe a versão da imagem')
})

test('especificadoresExternos acha import estático e dinâmico', () => {
  const t = "import { a } from 'npm:x@1.2.3'\nconst b = await import(\"jsr:@std/y@0.1.0\")\nimport 'https://esm.sh/z@1'"
  assert.deepEqual(especificadoresExternos(t), ['npm:x@1.2.3', 'jsr:@std/y@0.1.0', 'https://esm.sh/z@1'])
})
