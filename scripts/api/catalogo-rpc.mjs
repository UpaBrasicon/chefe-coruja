// Catálogo interno das RPCs (Fase 3, tarefa 6): uma linha por função pública
// do banco que o frontend conhece (src/types/database.ts), com os parâmetros,
// o retorno, a migration em que foi definida por último e os arquivos do
// frontend que a chamam. Gera docs/api/catalogo-rpc.md.
//
// Uso: npm run api:catalogo
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const RAIZ = process.cwd()
const tipos = readFileSync(join(RAIZ, 'src/types/database.ts'), 'utf8')

// bloco Functions do schema public
const ini = tipos.indexOf('    Functions: {', tipos.indexOf('  public: {'))
if (ini < 0) throw new Error('bloco Functions do schema public não encontrado em src/types/database.ts')
let nivel = 0, fim = ini
for (let i = tipos.indexOf('{', ini); i < tipos.length; i++) {
  if (tipos[i] === '{') nivel++
  else if (tipos[i] === '}') { nivel--; if (nivel === 0) { fim = i; break } }
}
const bloco = tipos.slice(tipos.indexOf('{', ini) + 1, fim)

// entradas de primeiro nível: "      nome: { ... }" (uma ou várias linhas)
const funcoes = []
let i = 0
while (i < bloco.length) {
  const m = /\n {6}([a-z_][a-z0-9_]*):\s*/y
  m.lastIndex = i
  const r = m.exec(bloco)
  if (!r) { i++; continue }
  let j = m.lastIndex, n = 0, k = j
  for (; k < bloco.length; k++) {
    if (bloco[k] === '{' || bloco[k] === '[') n++
    else if (bloco[k] === '}' || bloco[k] === ']') { n--; if (n === 0) break }
  }
  const corpo = bloco.slice(j, k + 1).replace(/\s+/g, ' ')
  funcoes.push({ nome: r[1], corpo })
  i = k + 1
}

const campo = (corpo, chave) => {
  const p = corpo.indexOf(chave + ':')
  if (p < 0) return ''
  let s = p + chave.length + 1
  while (corpo[s] === ' ') s++
  if (corpo[s] === '{') {
    let n = 0, k = s
    for (; k < corpo.length; k++) { if (corpo[k] === '{') n++; else if (corpo[k] === '}') { n--; if (n === 0) break } }
    return corpo.slice(s, k + 1)
  }
  const fimCampo = corpo.slice(s).search(/ (Args|Returns|SetofOptions):|\}$/)
  return corpo.slice(s, fimCampo < 0 ? undefined : s + fimCampo).trim()
}

// onde cada RPC é chamada no frontend
function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return arquivos(p)
    return /\.(ts|tsx)$/.test(n) && !n.endsWith('.test.ts') && !p.endsWith(`types${sep}database.ts`) ? [p] : []
  })
}
const fontes = arquivos(join(RAIZ, 'src')).map((p) => [relative(RAIZ, p).split(sep).join('/'), readFileSync(p, 'utf8')])

// última migration que define cada função
const migrations = readdirSync(join(RAIZ, 'supabase/migrations')).filter((n) => n.endsWith('.sql')).sort()
const definidaEm = new Map()
for (const m of migrations) {
  const sql = readFileSync(join(RAIZ, 'supabase/migrations', m), 'utf8')
  for (const r of sql.matchAll(/FUNCTION\s+public\.([a-z_][a-z0-9_]*)\s*\(/gi)) definidaEm.set(r[1].toLowerCase(), m)
}

const linhas = funcoes.map(({ nome, corpo }) => {
  const args = campo(corpo, 'Args')
  const ret = campo(corpo, 'Returns')
  const usos = fontes.filter(([, t]) => t.includes(`'${nome}'`) && /\.rpc\(/.test(t)).map(([p]) => p)
  return { nome, args: args === '{}' || args === 'never' || args === '' ? '—' : args, ret: ret || '—', mig: definidaEm.get(nome) ?? '—', usos }
}).sort((a, b) => a.nome.localeCompare(b.nome))

const esc = (s) => s.replace(/\|/g, '\\|')
const md = `# Catálogo interno das RPCs

Gerado por \`npm run api:catalogo\` (scripts/api/catalogo-rpc.mjs). **Não editar à mão.**

São as funções públicas do banco que o frontend conhece, tiradas de
\`src/types/database.ts\`. Cada linha traz os parâmetros, o retorno, a última
migration que define a função e os arquivos que a chamam. A API para
integradores externos é outra: está em \`docs/api/openapi.yaml\`.

- Funções: ${linhas.length}
- Sem chamada no frontend: ${linhas.filter((l) => l.usos.length === 0).length} (usadas por outras funções, por Edge Functions ou ainda sem tela)

| RPC | Parâmetros | Retorno | Migration | Chamada em |
|---|---|---|---|---|
${linhas.map((l) => `| \`${l.nome}\` | ${esc(l.args)} | ${esc(l.ret)} | ${l.mig} | ${l.usos.length ? l.usos.map((u) => `\`${u}\``).join('<br>') : '—'} |`).join('\n')}
`
writeFileSync(join(RAIZ, 'docs/api/catalogo-rpc.md'), md)
console.log(`catálogo: ${linhas.length} RPCs em docs/api/catalogo-rpc.md`)
