// Scan de segredos — revisão de fechamento
// Procura credenciais reais (não placeholders) no repositório, inclusive nos
// worktrees (.claude/worktrees). Pula só node_modules e .git, e os arquivos
// .env* locais (o ponto é eles NÃO estarem commitados; isso é conferido no fim).
// Uso: node scripts/auditoria-fases/scan-segredos.ts
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const IGNORAR = new Set(['node_modules', '.git'])

export const PADROES: [RegExp, string][] = [
  // service_role / anon JWT (eyJ...)
  [/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, 'JWT do Supabase'],
  // token pessoal do Supabase (sbp_) e chave secreta nova (sb_secret_)
  [/\bsbp_[A-Za-z0-9]{20,}/, 'token do Supabase (sbp_)'],
  [/\bsb_secret_[A-Za-z0-9_-]{20,}/, 'chave secreta do Supabase (sb_secret_)'],
  // senhas em connection strings
  [/postgres(ql)?:\/\/[^:\s]+:[^@\s]+@/, 'senha em connection string'],
  // chaves privadas
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'chave privada'],
  // tokens longos comuns
  [/\b(sk|pk|ghp|github_pat|xoxb|AKIA)[_-][A-Za-z0-9]{16,}/, 'token de serviço'],
  // chave da API do projeto (cc_live_/cc_test_ + 48 hex)
  [/\bcc_(live|test)_[0-9a-f]{32,}/, 'chave da API (cc_live_/cc_test_)'],
  // segredo de webhook (Standard Webhooks)
  [/\bwhsec_[A-Za-z0-9+/=]{24,}/, 'segredo de webhook (whsec_)'],
  // chave da Resend: re_<id>_<segredo>, com dígito ou maiúscula (não pega nome_em_snake_case)
  [/\bre_(?=[A-Za-z0-9_]*[A-Z0-9])[A-Za-z0-9]{6,12}_[A-Za-z0-9]{20,}/, 'chave da Resend (re_)'],
  // hash bcrypt (senha de conta)
  [/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/, 'hash bcrypt'],
]

/** Achados de um texto (rótulo + trecho mascarado). Puro, para teste. */
export function acharSegredos(conteudo: string): { rotulo: string; mascara: string }[] {
  const achados: { rotulo: string; mascara: string }[] = []
  for (const [re, rotulo] of PADROES) {
    const m = conteudo.match(re)
    if (m) {
      const achado = m[0]
      const mascara = achado.length > 24 ? achado.slice(0, 12) + '…' + achado.slice(-4) : achado.slice(0, 6) + '…'
      achados.push({ rotulo, mascara })
    }
  }
  return achados
}

/** Arquivo .env local (não versionado), exceto os exemplos. */
export function ehEnvLocal(caminho: string): boolean {
  const nome = basename(caminho)
  return nome.startsWith('.env') && !/\.example$/.test(nome)
}

function varrer(caminho: string, rel = ''): void {
  let entrada
  try { entrada = statSync(caminho) } catch { return }
  if (entrada.isDirectory()) {
    if (IGNORAR.has(basename(caminho))) return
    for (const f of readdirSync(caminho)) varrer(join(caminho, f), join(rel, f))
    return
  }
  if (ehEnvLocal(caminho)) return
  if (!/\.(ts|tsx|js|jsx|mjs|cjs|sql|json|toml|md|txt|yml|yaml|py|sh)$/.test(caminho)) return
  const conteudo = readFileSync(caminho, 'utf8')
  for (const a of acharSegredos(conteudo)) console.log(`⚠️  ${rel}: ${a.rotulo}: ${a.mascara}`)
}

function principal(): void {
  console.log('Scan de segredos (exclui node_modules, .git e .env* locais):')
  varrer(process.cwd())
  console.log('fim.')
  // os .env* locais não podem estar rastreados pelo git (os .example podem)
  try {
    const rastreados = execSync('git ls-files', { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f && ehEnvLocal(f))
    console.log(rastreados.length ? `⚠️  .env RASTREADO pelo git: ${rastreados.join(', ')}` : '✓ nenhum .env local no git (gitignore ok)')
  } catch {
    console.log('? não foi possível consultar o git')
  }
}

// só roda quando chamado direto (o teste importa sem executar)
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/scan-segredos.ts')) principal()
