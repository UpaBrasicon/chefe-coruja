// LG11, decisão C3: gera docs/regulatorio/LG11-MAPA-MODULO-CLINICO.md a partir
// de docs/regulatorio/modulo-clinico/mapa.json e confere que toda ficha de
// src/clinico está num grupo. Mesmo critério de ficha do scripts/fichas-sql.mjs.
// Uso:
//   node --experimental-strip-types scripts/modulo-clinico.mjs            confere e grava
//   node --experimental-strip-types scripts/modulo-clinico.mjs --conferir confere e falha se o documento estiver velho (CI)
//   node --experimental-strip-types scripts/modulo-clinico.mjs --sql      imprime o SQL das revisões exigidas (LG13)
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { conferirMapa, gerarDocumentoMapa, sqlRevisoes } from './modulo-clinico-regras.mjs'

const raiz = join(import.meta.dirname, '..')
const MAPA = join(raiz, 'docs/regulatorio/modulo-clinico/mapa.json')
const DOCUMENTO = join(raiz, 'docs/regulatorio/LG11-MAPA-MODULO-CLINICO.md')

const arquivos = (d) =>
  readdirSync(d).flatMap((a) => {
    const c = join(d, a)
    if (statSync(c).isDirectory()) return arquivos(c)
    return a.endsWith('.ts') && !a.endsWith('.test.ts') ? [c] : []
  })
const fichas = new Set()
for (const arq of arquivos(join(raiz, 'src/clinico'))) {
  const mod = await import(pathToFileURL(arq).href)
  for (const [nome, v] of Object.entries(mod)) {
    if (!v || typeof v !== 'object') continue
    const f = nome.startsWith('ficha') && v.id && v.versao ? v : v.ficha?.id && v.ficha?.versao ? v.ficha : null
    if (f) fichas.add(f.id)
  }
}

const mapa = JSON.parse(readFileSync(MAPA, 'utf8'))
const problemas = conferirMapa(mapa, fichas, (c) => existsSync(join(raiz, c)))
if (problemas.length) {
  console.error(`Mapa do módulo clínico (LG11) com ${problemas.length} problema(s):`)
  for (const p of problemas) console.error(`- ${p}`)
  console.error('Ponha a ficha num grupo de docs/regulatorio/modulo-clinico/mapa.json e rode `node --experimental-strip-types scripts/modulo-clinico.mjs`.')
  process.exit(1)
}

const texto = gerarDocumentoMapa(mapa)
if (process.argv.includes('--sql')) {
  // LG13: as revisões exigidas de todas as fichas, para uma migration
  console.log(sqlRevisoes(mapa))
} else if (process.argv.includes('--conferir')) {
  const atual = existsSync(DOCUMENTO) ? readFileSync(DOCUMENTO, 'utf8').replace(/\r\n/g, '\n') : ''
  if (atual !== texto) {
    console.error('docs/regulatorio/LG11-MAPA-MODULO-CLINICO.md está diferente do JSON. Rode `node --experimental-strip-types scripts/modulo-clinico.mjs` e faça o commit.')
    process.exit(1)
  }
  console.log(`Mapa do módulo clínico ok: ${fichas.size} fichas, ${mapa.funcoes.length} funções.`)
} else {
  writeFileSync(DOCUMENTO, texto)
  console.log(`Gravado ${DOCUMENTO}: ${fichas.size} fichas, ${mapa.funcoes.length} funções.`)
}
