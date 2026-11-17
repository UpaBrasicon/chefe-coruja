// LG4: gera docs/regulatorio/LG4-INVENTARIO.md a partir de docs/regulatorio/inventario/operacoes.json.
// Uso:
//   node scripts/inventario-lgpd.mjs            confere e grava o documento
//   node scripts/inventario-lgpd.mjs --conferir confere e falha se o documento estiver velho (CI)
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { conferir, gerarDocumento, tabelasDasMigrations } from './inventario-lgpd-regras.mjs'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const MIGRATIONS = join(RAIZ, 'supabase/migrations')
const INVENTARIO = join(RAIZ, 'docs/regulatorio/inventario/operacoes.json')
const DOCUMENTO = join(RAIZ, 'docs/regulatorio/LG4-INVENTARIO.md')

const arquivos = readdirSync(MIGRATIONS)
  .filter((n) => n.endsWith('.sql'))
  .map((nome) => ({ nome, conteudo: readFileSync(join(MIGRATIONS, nome), 'utf8') }))
const tabelas = tabelasDasMigrations(arquivos)
const inventario = JSON.parse(readFileSync(INVENTARIO, 'utf8'))

const problemas = conferir(inventario, tabelas)
if (problemas.length) {
  console.error(`Inventário LG4 com ${problemas.length} problema(s):`)
  for (const p of problemas) console.error(`- ${p}`)
  console.error('Classifique a tabela numa operação de docs/regulatorio/inventario/operacoes.json e rode `node scripts/inventario-lgpd.mjs`.')
  process.exit(1)
}

const texto = gerarDocumento(inventario)
if (process.argv.includes('--conferir')) {
  const atual = existsSync(DOCUMENTO) ? readFileSync(DOCUMENTO, 'utf8').replace(/\r\n/g, '\n') : ''
  if (atual !== texto) {
    console.error('docs/regulatorio/LG4-INVENTARIO.md está diferente do JSON. Rode `node scripts/inventario-lgpd.mjs` e faça o commit.')
    process.exit(1)
  }
  console.log(`Inventário LG4 ok: ${tabelas.size} tabelas das migrations, ${inventario.operacoes.length} operações.`)
} else {
  writeFileSync(DOCUMENTO, texto)
  console.log(`Gravado ${DOCUMENTO}: ${inventario.operacoes.length} operações, ${tabelas.size} tabelas das migrations.`)
}
