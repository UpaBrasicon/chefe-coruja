// ─────────────────────────────────────────────────────────────────────────────
// VIDaaS PSC — Prova de conceito isolada (spike)
//
// Fluxo OAuth 2.0 Authorization Code + PKCE (S256) contra o ambiente de
// HOMOLOGAÇÃO da Valid:
//   a. gera code_verifier + code_challenge (S256)
//   b. monta URL de autorização (signature_session, lifetime parametrizável)
//      e imprime o link / QR Code no terminal
//   c. listener local no redirect_uri captura o authorization code
//   d. troca code por access token
//   e. calcula SHA-256 de um PDF de exemplo e solicita a assinatura
//   f. imprime a resposta completa e salva em spikes/vidaas/saida/
//
// Uso:
//   node spikes/vidaas/vidaas-poc.ts                    # lê .env.local
//   node spikes/vidaas/vidaas-poc.ts --pdf caminho.pdf  # PDF custom
//
// Credenciais (no .env.local, NUNCA versionadas):
//   VIDAAS_CLIENT_ID
//   VIDAAS_CLIENT_SECRET
//   VIDAAS_REDIRECT_URI    (ex.: http://127.0.0.1:8765/callback)
//   VIDAAS_BASE_URL        (ambiente de homologação da Valid)
//   VIDAAS_LIFETIME        (minutos do QR/sessão — default 5)
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'

// ── carrega .env.local manualmente (sem depender de dotenv) ─────────────────
function carregarEnv(caminho: string): Record<string, string> {
  const env: Record<string, string> = {}
  if (!existsSync(caminho)) return env
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...process.env, ...carregarEnv(resolve('.env.local')) }

function exigir(nome: string): string {
  const v = env[nome]
  if (!v) throw new Error(`FALTA ${nome} no .env.local — não posso continuar sem a credencial real (regra: nada de mock)`)
  return v
}

// ── a. PKCE ──────────────────────────────────────────────────────────────────
function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function gerarCodeVerifier(): string {
  return base64url(randomBytes(48)) // 64 chars, alta entropia
}

function gerarCodeChallenge(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest())
}

// ── e. hash do PDF ───────────────────────────────────────────────────────────
function sha256Base64(caminho: string): string {
  const conteudo = readFileSync(caminho)
  return createHash('sha256').update(conteudo).digest('base64')
}

// ── c. listener local p/ capturar o authorization code ───────────────────────
function capturarCode(redirectUri: string, timeoutMs: number): Promise<{ code: string; raw: string }> {
  return new Promise((resolvePromise, reject) => {
    const u = new URL(redirectUri)
    const porta = Number(u.port || (u.protocol === 'https:' ? 443 : 80))
    const servidor = createServer((req, res) => {
      const url = new URL(req.url ?? '/', redirectUri)
      const code = url.searchParams.get('code')
      const erro = url.searchParams.get('error')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      if (erro) {
        res.end(`<h3>Erro na autorização</h3><pre>${erro}: ${url.searchParams.get('error_description') ?? ''}</pre>`)
        servidor.close()
        reject(new Error(`erro de autorização: ${erro} — ${url.searchParams.get('error_description') ?? ''}`))
        return
      }
      if (!code) {
        res.end('<h3>Sem code na resposta</h3><p>Feche esta aba e veja o terminal.</p>')
        return
      }
      res.end('<h3>✓ Código recebido. Feche esta aba e veja o terminal.</h3>')
      servidor.close()
      resolvePromise({ code, raw: req.url ?? '' })
    })
    servidor.on('error', (err) => reject(new Error(`listener falhou (porta ${porta}): ${err.message}`)))
    servidor.listen(porta, () => {
      console.log(`  listener em ${redirectUri} aguardando o callback…`)
    })
    setTimeout(() => {
      servidor.close()
      reject(new Error(`timeout de ${timeoutMs / 1000}s aguardando o código de autorização`))
    }, timeoutMs)
  })
}

// ── d. troca de code por token ────────────────────────────────────────────────
async function trocarCode(args: {
  baseUrl: string
  tokenEndpoint: string
  clientId: string
  clientSecret: string
  redirectUri: string
  code: string
  codeVerifier: string
}): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    code_verifier: args.codeVerifier,
  })
  const res = await fetch(`${args.baseUrl}${args.tokenEndpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const texto = await res.text()
  let json: Record<string, unknown> | null = null
  try { json = JSON.parse(texto) } catch { /* resposta não-JSON */ }
  if (!res.ok) {
    throw new Error(`token endpoint ${res.status}: ${texto.slice(0, 500)}`)
  }
  return json ?? { raw: texto }
}

// ── f. salvar saída ───────────────────────────────────────────────────────────
function salvarSaida(nome: string, conteudo: string) {
  const dir = resolve('spikes/vidaas/saida')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, nome), conteudo)
  console.log(`  salvo em spikes/vidaas/saida/${nome}`)
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const clientId = exigir('VIDAAS_CLIENT_ID')
  const clientSecret = exigir('VIDAAS_CLIENT_SECRET')
  const redirectUri = exigir('VIDAAS_REDIRECT_URI')
  const baseUrl = exigir('VIDAAS_BASE_URL').replace(/\/+$/, '')
  const lifetime = Number(env.VIDAAS_LIFETIME ?? '5')

  // endpoints do manual — PENDENTE: preencher com o manual oficial
  // (se o manual usar caminhos diferentes, ajuste aqui SEM alterar fora de spikes/)
  const authorizeEndpoint = env.VIDAAS_AUTHORIZE_ENDPOINT ?? '/oauth/authorize'
  const tokenEndpoint = env.VIDAAS_TOKEN_ENDPOINT ?? '/oauth/token'
  const signEndpoint = env.VIDAAS_SIGN_ENDPOINT ?? '/signature'
  const scope = env.VIDAAS_SCOPE ?? 'signature_session'

  const pdfArg = process.argv.find((a, i) => a === '--pdf' && process.argv[i + 1])
  const pdfPath = pdfArg ? process.argv[process.argv.indexOf('--pdf') + 1] : resolve('spikes/vidaas/assinatura-exemplo.pdf')
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF de exemplo não encontrado: ${pdfPath} — coloque um PDF em spikes/vidaas/assinatura-exemplo.pdf ou use --pdf`)
  }

  console.log('VIDaaS PSC — prova de conceito (homologação)')
  console.log('  base URL :', baseUrl)
  console.log('  client   :', clientId.slice(0, 8) + '…')
  console.log('  redirect :', redirectUri)
  console.log('  lifetime :', lifetime, 'min | pdf:', pdfPath)

  // a. PKCE
  const codeVerifier = gerarCodeVerifier()
  const codeChallenge = gerarCodeChallenge(codeVerifier)
  console.log('\n[a] PKCE gerado (S256)')

  // b. URL de autorização
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope,
    lifetime: String(lifetime),
  })
  const authUrl = `${baseUrl}${authorizeEndpoint}?${params.toString()}`
  console.log('\n[b] Autorize no navegador/celular (QR abaixo ou abra o link):')
  console.log('  ' + authUrl)
  try {
    const qrcode = await import('qrcode-terminal')
    qrcode.default.generate(authUrl, { small: true })
  } catch {
    console.log('  (qrcode-terminal não instalado — use o link acima)')
  }

  // c. listener
  console.log('\n[c] Aguardando autorização…')
  const { code, raw } = await capturarCode(redirectUri, (Number(env.VIDAAS_TIMEOUT_MS) || 120_000))
  console.log(`  ✓ code recebido (${code.slice(0, 8)}…) | raw: ${raw.slice(0, 80)}`)
  salvarSaida('01-authorization-code.txt', `${code}\n\n${raw}`)

  // d. token
  console.log('\n[d] Trocando code por access token…')
  const tokenRes = await trocarCode({
    baseUrl, tokenEndpoint, clientId, clientSecret, redirectUri, code, codeVerifier,
  })
  console.log('  ✓ token recebido')
  const tokenJson = JSON.stringify(tokenRes, null, 2)
  salvarSaida('02-token-response.json', tokenJson)

  const accessToken = String(tokenRes.access_token ?? '')
  if (!accessToken) throw new Error('resposta de token sem access_token — verificar 02-token-response.json')

  // e. hash do PDF + solicitar assinatura
  const pdfHash = sha256Base64(pdfPath)
  console.log('\n[e] Hash SHA-256 do PDF (base64):', pdfHash)
  salvarSaida('03-pdf-hash.txt', pdfHash + '\n\n' + pdfPath)

  const signBody = {
    hash: pdfHash,
    hash_algorithm: 'SHA-256',
    // PENDENTE: campo(s) exato(s) da solicitação de assinatura segundo o manual
  }
  const signRes = await fetch(`${baseUrl}${signEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(signBody),
  })
  const signTexto = await signRes.text()
  console.log(`  assinatura endpoint ${signEndpoint} → ${signRes.status}`)
  console.log('  resposta:', signTexto.slice(0, 2000))
  salvarSaida('04-assinatura-response.json', JSON.stringify({ status: signRes.status, body: signTexto }, null, 2))

  console.log('\n✓ Fluxo completo executado — respostas em spikes/vidaas/saida/')
}

main().catch((err) => {
  console.error('\n✗ ERRO:', (err as Error).message)
  process.exit(1)
})
