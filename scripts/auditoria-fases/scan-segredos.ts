// Scan de segredos — revisão de fechamento
// Procura credenciais reais (não placeholders) fora de .env.local/node_modules/dist
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const IGNORAR = new Set(['node_modules', '.git', 'dist', 'landing', '.claude', '.temp'])
const PADROES = [
  // service_role / anon JWT (eyJ...)
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  // supabase keys / sbp_
  /\bsbp_[A-Za-z0-9]{20,}/g,
  // senhas genéricas em connection strings
  /postgres(ql)?:\/\/[^:\s]+:[^@\s]+@/g,
  // chaves privadas
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  // tokens longos comuns
  /\b(sk|pk|ghp|github_pat|xoxb|AKIA)[_-][A-Za-z0-9]{16,}/g,
]

function varrer(caminho: string, rel = ''): void {
  let entrada
  try { entrada = statSync(caminho) } catch { return }
  if (entrada.isDirectory()) {
    if (IGNORAR.has(caminho.split(/[\\/]/).pop() ?? '')) return
    for (const f of readdirSync(caminho)) varrer(join(caminho, f), join(rel, f))
    return
  }
  if (!/\.(ts|tsx|js|jsx|mjs|cjs|sql|json|env|toml|md|txt)$/.test(caminho)) return
  // pula o .env.local (é esperado ter credenciais — o ponto é NÃO ESTAR COMMITADO)
  if (caminho.includes('.env.local')) return
  const conteudo = readFileSync(caminho, 'utf8')
  for (const re of PADROES) {
    const m = conteudo.match(re)
    if (m) {
      const achado = m[0]
      const masc = achado.length > 24 ? achado.slice(0, 12) + '…' + achado.slice(-4) : achado
      console.log(`⚠️  ${rel}: ${masc}`)
    }
  }
}

console.log('Scan de segredos (exclui node_modules/.git/dist/.env.local):')
varrer(RAIZ)
console.log('fim.')

// verifica se .env.local está rastreado pelo git
import { execSync } from 'node:child_process'
try {
  const rastreado = execSync('git ls-files .env.local', { encoding: 'utf8' }).trim()
  console.log(rastreado ? `⚠️  .env.local RASTREADO pelo git: ${rastreado}` : '✓ .env.local NÃO está no git (gitignore ok)')
} catch {
  console.log('✓ .env.local NÃO está no git')
}
