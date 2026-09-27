// Gera a migration que registra no banco as versões das fichas de src/clinico.
// Uso: node --experimental-strip-types scripts/fichas-sql.mjs <nome-da-migration>
//   (npm run fichas:sql -- 20261001000001_fase5_fichas)
// Versão já registrada não muda (ON CONFLICT DO NOTHING): regra alterada tem
// de ganhar versão nova, e a versão nova entra aguardando aprovação.
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const nome = process.argv[2]
if (!nome) {
  console.error('informe o nome da migration, ex.: 20261001000001_fase5_fichas')
  process.exit(1)
}

const dir = join(import.meta.dirname, '..', 'src', 'clinico')
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const fichas = []
for (const arq of readdirSync(dir).filter((a) => a.endsWith('.ts') && !a.endsWith('.test.ts'))) {
  const mod = await import(pathToFileURL(join(dir, arq)).href)
  for (const [nomeExport, valor] of Object.entries(mod)) {
    if (nomeExport.startsWith('ficha') && valor && typeof valor === 'object' && valor.id && valor.versao) fichas.push(valor)
  }
}
fichas.sort((a, b) => a.id.localeCompare(b.id))
const ids = new Set()
for (const f of fichas) {
  if (ids.has(f.id)) throw new Error('id de ficha repetido: ' + f.id)
  ids.add(f.id)
  if (!f.fontes?.length) throw new Error('ficha sem fonte: ' + f.id)
}

const linhas = [
  '-- Gerado por scripts/fichas-sql.mjs a partir de src/clinico. Não editar à mão.',
  ...fichas.map((f) => `SELECT private.registrar_versao_ferramenta(${q(f.id)}, ${q(f.titulo)}, ${q(f.versao)}, ${q(f.publico)}, ${q(JSON.stringify(f.fontes))}::jsonb);`),
]
const destino = join(import.meta.dirname, '..', 'supabase', 'migrations', nome + '.sql')
writeFileSync(destino, linhas.join('\n') + '\n')
console.log(`${fichas.length} fichas → ${destino}`)
