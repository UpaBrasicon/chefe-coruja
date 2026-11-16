// Unidade de demonstração (pedido 8, J4): captura as telas da página de entrada.
//
// Entra na homologação como a coordenadora fictícia (Simone Aparecida Prado,
// d0300000-…-0001), que não tem senha. O roteiro:
//   1. tira o bloqueio da conta só durante a captura (a senha continua vazia,
//      então só entra quem tem o link gerado aqui com a chave de serviço);
//   2. gera um link de acesso único e entra por ele num navegador sem janela;
//   3. tira as telas em 1424 × 749, em JPG;
//   4. bloqueia a conta de novo, mesmo se algo falhar.
//
// SÓ NA HOMOLOGAÇÃO: o projeto é fixo (kswurfyxxvfydpjfrivy).
//
// Uso (da raiz do repositório, com o 02 rodado há pouco):
//   HOMOLOG_SHARE="<link de compartilhamento do Vercel para homolog.chefecoruja.com.br>" \
//     node scripts/demo/capturar-telas.mjs [pasta-de-saída]
// Variáveis opcionais: SUPABASE_SERVICE_ROLE_KEY (senão lê pelo CLI do Supabase,
// sem imprimir) e NAVEGADOR (caminho do Edge ou do Chrome).
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const REF = 'kswurfyxxvfydpjfrivy'
const API = `https://${REF}.supabase.co`
const SITE = 'https://homolog.chefecoruja.com.br'
const COORDENADORA = 'd0300000-0000-4000-8000-000000000001'
const UNIDADE = 'UPA 24h Jardim Primavera'
const TELAS = [
  { arquivo: 'porta.jpg', rota: '/gestao/porta' },
  { arquivo: 'painel.jpg', rota: '/gestao' },
  { arquivo: 'escala.jpg', rota: '/escala' },
]
const saida = process.argv[2] ?? join('tmp', 'telas-demo')
const navegador = process.env.NAVEGADOR ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const share = process.env.HOMOLOG_SHARE
if (!share?.startsWith(SITE)) {
  console.error('Defina HOMOLOG_SHARE com o link de compartilhamento do Vercel para a homologação.')
  process.exit(1)
}

function chaveServico() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  const txt = execSync(`npx supabase projects api-keys --project-ref ${REF} -o json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const chave = JSON.parse(txt.slice(txt.indexOf('['))).find((c) => c.name === 'service_role')?.api_key
  if (!chave) throw new Error('Chave de serviço da homologação não encontrada.')
  return chave
}
const srk = chaveServico()
const cabecalho = { apikey: srk, Authorization: `Bearer ${srk}`, 'Content-Type': 'application/json' }

async function admin(metodo, caminho, corpo) {
  const r = await fetch(`${API}/auth/v1/admin/${caminho}`, { method: metodo, headers: cabecalho, body: JSON.stringify(corpo) })
  if (!r.ok) throw new Error(`${metodo} ${caminho}: HTTP ${r.status}`)
  return r.json()
}

const conta = await admin('GET', `users/${COORDENADORA}`).catch(() => null)
if (!conta?.email?.endsWith('@demo.local')) throw new Error('A coordenadora fictícia não existe: rode antes o 01.')

let navegadorAberto
try {
  await admin('PUT', `users/${COORDENADORA}`, { ban_duration: 'none' })
  const link = await admin('POST', 'generate_link', { type: 'magiclink', email: conta.email })
  const verificar = await fetch(link.action_link ?? link.properties.action_link, { redirect: 'manual' })
  const fragmento = (verificar.headers.get('location') ?? '').split('#')[1] ?? ''
  if (!fragmento.includes('access_token')) throw new Error(`O link de acesso não devolveu sessão (HTTP ${verificar.status}).`)

  navegadorAberto = await chromium.launch({ executablePath: navegador, headless: true })
  const pagina = await navegadorAberto.newPage({ viewport: { width: 1424, height: 749 }, deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  await pagina.goto(share, { waitUntil: 'domcontentloaded' })
  await pagina.goto(`${SITE}/login#${fragmento}`, { waitUntil: 'load' })
  // a tela de login guarda a sessão do link e fica parada; o app abre depois
  await pagina.waitForFunction(() => Object.keys(sessionStorage).some((k) => k.startsWith('sb-')), null, { timeout: 20_000 })
  await pagina.goto(`${SITE}/inicio`, { waitUntil: 'load' })
  await pagina.waitForURL((u) => !u.pathname.startsWith('/inicio') && !u.pathname.startsWith('/login'), { timeout: 20_000 })
  if (new URL(pagina.url()).pathname.startsWith('/seletor')) {
    await pagina.getByText(UNIDADE, { exact: true }).click()
    await pagina.waitForURL((u) => !u.pathname.startsWith('/seletor'), { timeout: 20_000 })
  }

  mkdirSync(saida, { recursive: true })
  for (const tela of TELAS) {
    await pagina.goto(`${SITE}${tela.rota}`, { waitUntil: 'load' })
    await pagina.waitForTimeout(4000)
    await pagina.screenshot({ path: join(saida, tela.arquivo), type: 'jpeg', quality: 82 })
    console.log(`${tela.arquivo}: ${new URL(pagina.url()).pathname}`)
  }
  await pagina.evaluate(() => window.localStorage.clear())
} finally {
  await navegadorAberto?.close()
  await admin('PUT', `users/${COORDENADORA}`, { ban_duration: '876000h' })
  console.log('Conta da coordenadora bloqueada de novo.')
}
