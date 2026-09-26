// Regenera src/types/database.ts a partir do banco LOCAL (npx supabase start)
// e anexa os aliases escritos à mão (src/types/database.aliases.ts.txt).
// Uso: npm run gen:tipos
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const url = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const gerado = execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['supabase', 'gen', 'types', 'typescript', '--db-url', url, '--schema', 'public', '--schema', 'terminologia'],
  { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 },
)
const aliases = readFileSync('src/types/database.aliases.ts.txt', 'utf8')
writeFileSync('src/types/database.ts', `${gerado.trimEnd()}\n\n${aliases}`)
console.log('src/types/database.ts regenerado')
