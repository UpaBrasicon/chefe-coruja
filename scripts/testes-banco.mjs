// Roda todos os testes de banco (supabase/tests/*.sql) no banco LOCAL com o
// seed, cada um numa transação com ROLLBACK. Falha se algum der ERROR.
// Uso: npm run test:banco   (precisa de `npx supabase start`)
// O contêiner é `supabase_db_<project_id>` (supabase/config.toml) no Windows e
// no Linux do CI; SUPABASE_DB_CONTAINER troca o nome se precisar.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'supabase', 'tests')
const conteiner = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_chefe-coruja'
let falhas = 0
for (const arq of readdirSync(dir).filter((a) => a.endsWith('.sql')).sort()) {
  let saida
  let codigo = 0
  try {
    saida = execFileSync('docker', ['exec', '-i', conteiner, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
      input: readFileSync(join(dir, arq)), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    saida = String(e.stdout ?? '') + String(e.stderr ?? '')
    codigo = e.status ?? 1
  }
  // Saída diferente de zero sem linha ERROR (contêiner ausente, docker fora do
  // ar, psql sem conexão) também é falha — antes passava como ✔.
  const erro = saida.split('\n').find((l) => /ERROR|FALHOU/.test(l))
    ?? (codigo ? (saida.split('\n').find((l) => l.trim()) || `saída ${codigo}`) : undefined)
  if (erro) { falhas++; console.log(`✖ ${arq}\n    ${erro.trim()}`) } else console.log(`✔ ${arq}`)
}
if (falhas) { console.log(`${falhas} arquivo(s) com falha`); process.exit(1) }
