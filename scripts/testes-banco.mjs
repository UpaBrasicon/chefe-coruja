// Roda todos os testes de banco (supabase/tests/*.sql) no banco LOCAL com o
// seed, cada um numa transação com ROLLBACK. Falha se algum der ERROR.
// Uso: npm run test:banco   (precisa de `npx supabase start`)
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'supabase', 'tests')
let falhas = 0
for (const arq of readdirSync(dir).filter((a) => a.endsWith('.sql')).sort()) {
  let saida
  try {
    saida = execFileSync('docker', ['exec', '-i', 'supabase_db_chefe-coruja', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
      input: readFileSync(join(dir, arq)), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    saida = String(e.stdout ?? '') + String(e.stderr ?? '')
  }
  const erro = saida.split('\n').find((l) => /ERROR|FALHOU/.test(l))
  if (erro) { falhas++; console.log(`✖ ${arq}\n    ${erro.trim()}`) } else console.log(`✔ ${arq}`)
}
if (falhas) { console.log(`${falhas} arquivo(s) com falha`); process.exit(1) }
