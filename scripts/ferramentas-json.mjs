// Exporta as ferramentas do registry (src/content/registry.tsx) para
// biblioteca/ferramentas.json — a busca semântica de calculadoras da
// biblioteca (index_tools.py) e a busca local (Fuse.js) usam o mesmo formato.
// Uso: node --experimental-strip-types scripts/ferramentas-json.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const raiz = join(import.meta.dirname, '..')
const registry = readFileSync(join(raiz, 'src/content/registry.tsx'), 'utf8')
const { GRUPOS_SECAO } = await import(pathToFileURL(join(raiz, 'src/content/gruposSecoes.ts')).href)

const TIPO = {
  calculadoras: 'calculadora', pediatria: 'conduta', emergencias: 'conduta', escores: 'escore',
  protocolos: 'protocolo', farmacia: 'farmacia', dengue: 'protocolo', games: 'jogo', 'ventilacao-mecanica': 'calculadora',
}

const secoes = [...registry.matchAll(/slug: '([a-z0-9-]+)',\r?\n\s+label: '([^']+)'/g)]
  .map((m) => ({ slug: m[1], label: m[2], pos: m.index }))
const grupoDe = {}
for (const [secao, grupos] of Object.entries(GRUPOS_SECAO))
  for (const g of grupos) for (const s of g.slugs) grupoDe[`${secao}/${s}`] = g.rotulo

const re = /t\('([a-z0-9-]+)', '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', sobDemanda\(\(\) => import\('[^']+'\), '\w+'\)(?:, \[([^\]]*)\])?\)/g
const limpar = (s) => s.replace(/\\'/g, "'")
const saida = []
for (const m of registry.matchAll(re)) {
  const secao = secoes.filter((s) => s.pos < m.index).at(-1)
  const tags = m[4] ? [...m[4].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => limpar(x[1])) : []
  saida.push({
    id: m[1],
    nome: limpar(m[2]),
    tipo: TIPO[secao.slug] ?? 'ferramenta',
    secao: secao.label,
    categoria: grupoDe[`${secao.slug}/${m[1]}`] ?? secao.label,
    sinonimos: tags,
    descricao: limpar(m[3]),
    rota: `/plantonista/${secao.slug}/${m[1]}`,
  })
}
const esperado = (registry.match(/sobDemanda\(\(\) => import/g) ?? []).length
if (saida.length !== esperado) throw new Error(`registry tem ${esperado} ferramentas, exportadas ${saida.length}`)
writeFileSync(join(raiz, 'biblioteca/ferramentas.json'), JSON.stringify(saida, null, 1) + '\n')
console.log(`${saida.length} ferramentas em biblioteca/ferramentas.json`)
