// Backlog comercial, item 8: grava o vídeo de venda na homologação.
//
// Entra como a coordenadora fictícia (Simone Aparecida Prado, d0300000-…-0001),
// sem senha, por um link de acesso único, como o capturar-telas.mjs:
//   1. tira o bloqueio da conta só durante a gravação;
//   2. grava a sessão inteira pelos quadros do navegador, em MP4 (1920 × 1080), e anota o início e o fim
//      de cada cena num JSON ao lado;
//   3. bloqueia a conta de novo, mesmo se algo falhar.
// A montagem (cortes, legendas, cartelas, MP4) é do montar-video.mjs.
//
// SÓ NA HOMOLOGAÇÃO: o projeto é fixo (kswurfyxxvfydpjfrivy). Antes, rode o 02
// (plantão de agora), o 04 (UBS e regulação) e o 05 (acesso da coordenadora).
//
// Uso (da raiz do repositório):
//   HOMOLOG_SHARE="<link de compartilhamento do Vercel>" \
//     node scripts/demo/gravar-video.mjs docs/comercial/video/cenas.json tmp/video
// FFMPEG: caminho do ffmpeg.exe. Variáveis opcionais: SUPABASE_SERVICE_ROLE_KEY e NAVEGADOR, como no capturar-telas.mjs;
// SO_CENAS="3,4" grava só essas cenas (para regravar uma).
import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const REF = 'kswurfyxxvfydpjfrivy'
const API = `https://${REF}.supabase.co`
const SITE = 'https://homolog.chefecoruja.com.br'
const COORDENADORA = 'd0300000-0000-4000-8000-000000000001'
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const LARGURA = 1920
const ALTURA = 1080

const [arqCenas, saida = join('tmp', 'video')] = process.argv.slice(2)
if (!arqCenas) { console.error('Uso: node scripts/demo/gravar-video.mjs <cenas.json> [pasta]'); process.exit(1) }
const roteiro = JSON.parse(readFileSync(arqCenas, 'utf8'))
const soCenas = process.env.SO_CENAS ? new Set(process.env.SO_CENAS.split(',').map(Number)) : null
const navegador = process.env.NAVEGADOR ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const share = process.env.HOMOLOG_SHARE
if (!share?.startsWith(SITE)) { console.error('Defina HOMOLOG_SHARE com o link de compartilhamento do Vercel para a homologação.'); process.exit(1) }

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

// ── ações de cena ───────────────────────────────────────────────────────────
const espera = (p, ms) => p.waitForTimeout(ms)

async function rolar(p, { ate = 'fim', px, ms = 4000, seletor } = {}) {
  // rolagem suave, pelo elemento rolável indicado ou pela página
  await p.evaluate(async ({ ate, px, ms, seletor }) => {
    const el = seletor ? document.querySelector(seletor) : (document.querySelector('main') && document.querySelector('main').scrollHeight > document.querySelector('main').clientHeight ? document.querySelector('main') : document.scrollingElement)
    if (!el) return
    const inicio = el.scrollTop
    const alvo = ate === 'topo' ? 0 : px != null ? inicio + px : el.scrollHeight - el.clientHeight
    const t0 = performance.now()
    await new Promise((fim) => {
      const passo = (t) => {
        const k = Math.min(1, (t - t0) / ms)
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        el.scrollTop = inicio + (alvo - inicio) * e
        if (k < 1) requestAnimationFrame(passo); else fim()
      }
      requestAnimationFrame(passo)
    })
  }, { ate, px, ms, seletor })
}

async function cursor(p) {
  // cursor visível no vídeo (o modo sem janela não desenha o do sistema)
  await p.evaluate(() => {
    if (document.getElementById('cc-cursor-video')) return
    const c = document.createElement('div')
    c.id = 'cc-cursor-video'
    Object.assign(c.style, { position: 'fixed', zIndex: 2147483647, width: '22px', height: '22px', marginLeft: '-11px', marginTop: '-11px',
      borderRadius: '50%', border: '2px solid rgba(255,255,255,.95)', background: 'rgba(56,189,248,.45)', boxShadow: '0 0 0 2px rgba(15,23,42,.5)',
      pointerEvents: 'none', left: '-50px', top: '-50px', transition: 'transform .12s' })
    document.body.appendChild(c)
    document.addEventListener('mousemove', (e) => { c.style.left = `${e.clientX}px`; c.style.top = `${e.clientY}px` }, true)
    document.addEventListener('mousedown', () => { c.style.transform = 'scale(.7)' }, true)
    document.addEventListener('mouseup', () => { c.style.transform = 'scale(1)' }, true)
  })
}

// espera a tela terminar de carregar: nenhum indicador girando por 0,8 s (até 40 s)
async function carregada(p) {
  await p.waitForFunction(() => {
    const girando = [...document.querySelectorAll('.animate-spin')].some((e) => e.getClientRects().length > 0)
    const w = window
    if (girando) { w.__ccQuieto = 0; return false }
    w.__ccQuieto = (w.__ccQuieto || 0) + 1
    return w.__ccQuieto >= 8
  }, null, { timeout: 40_000, polling: 100 }).catch(() => {})
}

async function alvo(p, a) {
  if (a.papel) return p.getByRole(a.papel, { name: a.nome, exact: a.exato ?? false }).first()
  if (a.texto) return p.getByText(a.texto, { exact: a.exato ?? false }).first()
  if (a.rotulo) return p.getByLabel(a.rotulo, { exact: a.exato ?? false }).first()
  if (a.marcador) return p.getByPlaceholder(a.marcador, { exact: a.exato ?? false }).first()
  return p.locator(a.seletor).first()
}

async function moverAte(p, loc) {
  await loc.scrollIntoViewIfNeeded({ timeout: 8000 })
  const caixa = await loc.boundingBox()
  if (caixa) await p.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2, { steps: 25 })
  return caixa
}

async function abrirMenuUsuario(p) {
  await moverAte(p, p.getByRole('button', { name: 'Menu do usuário' }))
  await p.getByRole('button', { name: 'Menu do usuário' }).click()
  await espera(p, 600)
}

async function executar(p, a) {
  switch (a.acao) {
    case 'ir':
      await p.goto(`${SITE}${a.rota}`, { waitUntil: 'load' })
      await carregada(p)
      await espera(p, a.ms ?? 2500)
      await cursor(p)
      return
    case 'esperar': return espera(p, a.ms)
    case 'rolar': return rolar(p, a)
    case 'pairar': { const loc = await alvo(p, a); await moverAte(p, loc); return espera(p, a.ms ?? 800) }
    case 'clicar': {
      const loc = await alvo(p, a)
      await moverAte(p, loc)
      await espera(p, 250)
      await loc.click({ timeout: 10_000 })
      return espera(p, a.ms ?? 1200)
    }
    case 'digitar': {
      const loc = await alvo(p, a)
      await moverAte(p, loc)
      await loc.click()
      // limpa antes: o rascunho do médico guarda o texto entre sessões
      if (a.limpar) await loc.fill('')
      await loc.pressSequentially(a.valor, { delay: a.atraso ?? 45 })
      return espera(p, a.ms ?? 600)
    }
    case 'tecla': await p.keyboard.press(a.tecla); return espera(p, a.ms ?? 800)
    case 'perfil': {
      await abrirMenuUsuario(p)
      const r = p.getByRole('radio', { name: a.nome, exact: true })
      await moverAte(p, r); await r.click()
      return espera(p, a.ms ?? 2500)
    }
    case 'tema': {
      await abrirMenuUsuario(p)
      const r = p.getByRole('radio', { name: a.nome, exact: true })
      await moverAte(p, r); await r.click()
      await espera(p, 900)
      await p.keyboard.press('Escape')
      return espera(p, a.ms ?? 1200)
    }
    case 'unidade': {
      await p.goto(`${SITE}/seletor`, { waitUntil: 'load' })
      await espera(p, 1500); await cursor(p)
      const loc = p.getByText(a.nome, { exact: true })
      await moverAte(p, loc); await loc.click()
      await p.waitForURL((u) => !u.pathname.startsWith('/seletor'), { timeout: 20_000 })
      return espera(p, a.ms ?? 2500)
    }
    case 'rolar_ate':
      // rolagem suave até um elemento (âncora da página pública, bloco da tela)
      await p.evaluate(async ({ seletor, ms, folga }) => {
        const alvoEl = document.querySelector(seletor)
        if (!alvoEl) return
        const box = document.scrollingElement
        const inicio = box.scrollTop
        const fim = Math.min(box.scrollHeight - box.clientHeight, inicio + alvoEl.getBoundingClientRect().top - folga)
        const t0 = performance.now()
        await new Promise((ok) => {
          const passo = (t) => {
            const k = Math.min(1, (t - t0) / ms)
            const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
            box.scrollTop = inicio + (fim - inicio) * e
            if (k < 1) requestAnimationFrame(passo); else ok()
          }
          requestAnimationFrame(passo)
        })
      }, { seletor: a.seletor, ms: a.ms ?? 2500, folga: a.folga ?? 60 })
      return espera(p, a.pausa ?? 600)
    case 'esperar_texto':
      await p.getByText(a.texto, { exact: a.exato ?? false }).first().waitFor({ timeout: a.limite ?? 60_000 })
      return espera(p, a.ms ?? 500)
    default: throw new Error(`Ação desconhecida: ${a.acao}`)
  }
}

// ── gravação ────────────────────────────────────────────────────────────────
const conta = await admin('GET', `users/${COORDENADORA}`).catch(() => null)
if (!conta?.email?.endsWith('@demo.local')) throw new Error('A coordenadora fictícia não existe: rode antes o 01.')
mkdirSync(saida, { recursive: true })
const sufixo = soCenas ? `-${[...soCenas].join('-')}` : ''
const escolhidas = roteiro.cenas.filter((c) => !c.cartela && (!soCenas || soCenas.has(c.n)))

async function gravar(nav, cenas, nome, entrar) {
  if (!cenas.length) return
  const ctx = await nav.newContext({ viewport: { width: LARGURA, height: ALTURA }, deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo',
    colorScheme: roteiro.tema_inicial === 'claro' ? 'light' : 'dark' })
  const p = await ctx.newPage()
  // quadros pelo screencast do navegador (o recordVideo do Playwright pede um ffmpeg próprio)
  const pastaQuadros = join(saida, `quadros-${nome}${sufixo}`)
  mkdirSync(pastaQuadros, { recursive: true })
  const quadros = []
  const cdp = await ctx.newCDPSession(p)
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const arq = join(pastaQuadros, `q${String(quadros.length).padStart(6, '0')}.jpg`)
    writeFileSync(arq, Buffer.from(data, 'base64'))
    quadros.push({ arq, t: metadata.timestamp })
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: LARGURA, maxHeight: ALTURA, everyNthFrame: 1 })
  const t0 = Date.now()
  const marcas = []
  await p.goto(share, { waitUntil: 'domcontentloaded' })
  if (entrar) await entrar(p)
  for (const cena of cenas) {
    let ini = (Date.now() - t0) / 1000
    try {
      for (const [i, a] of cena.acoes.entries()) {
        await executar(p, a)
        // a cena começa com a primeira tela já carregada
        if (i === 0 && a.acao === 'ir') ini = (Date.now() - t0) / 1000 - Math.min(a.ms ?? 2500, 1500) / 1000
      }
    } catch (e) {
      console.error(`Cena ${cena.n}: ${e.message}`)
      marcas.push({ n: cena.n, ini, fim: (Date.now() - t0) / 1000, erro: e.message })
      continue
    }
    const fim = (Date.now() - t0) / 1000
    marcas.push({ n: cena.n, ini, fim })
    console.log(`cena ${cena.n}: ${ini.toFixed(1)}–${fim.toFixed(1)} s ${new URL(p.url()).pathname}`)
  }
  if (entrar) await p.evaluate(() => { try { window.localStorage.clear() } catch {} })
  await espera(p, 600)
  await cdp.send('Page.stopScreencast').catch(() => {})
  await ctx.close()
  // quadros com a duração de cada um até o seguinte; o vídeo começa em t0
  const base = t0 / 1000
  const linhas = []
  for (let i = 0; i < quadros.length; i++) {
    const ate = i + 1 < quadros.length ? quadros[i + 1].t : quadros[i].t + 0.5
    const de = i === 0 ? base : quadros[i].t
    linhas.push(`file '${resolve(quadros[i].arq).replace(/\\/g, '/')}'`, `duration ${Math.max(0.001, ate - de).toFixed(4)}`)
  }
  if (quadros.length) linhas.push(`file '${resolve(quadros.at(-1).arq).replace(/\\/g, '/')}'`)
  const lista = join(pastaQuadros, 'lista.txt')
  writeFileSync(lista, linhas.join('\n'), 'utf8')
  const destino = join(saida, `${nome}${sufixo}.mp4`)
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista,
    '-vf', `scale=${LARGURA}:${ALTURA}:force_original_aspect_ratio=decrease,pad=${LARGURA}:${ALTURA}:(ow-iw)/2:(oh-ih)/2,fps=30`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'veryfast', destino], { stdio: ['ignore', 'inherit', 'inherit'] })
  writeFileSync(destino.replace(/\.mp4$/, '.json'), JSON.stringify({ video: destino, marcas }, null, 2))
  console.log(`Vídeo: ${destino}`)
}

let nav
try {
  nav = await chromium.launch({ executablePath: navegador, headless: true })
  // página pública: sem login
  await gravar(nav, escolhidas.filter((c) => c.publica), 'sessao-publica', null)

  await admin('PUT', `users/${COORDENADORA}`, { ban_duration: 'none' })
  const link = await admin('POST', 'generate_link', { type: 'magiclink', email: conta.email })
  const verificar = await fetch(link.action_link ?? link.properties.action_link, { redirect: 'manual' })
  const fragmento = (verificar.headers.get('location') ?? '').split('#')[1] ?? ''
  if (!fragmento.includes('access_token')) throw new Error(`O link de acesso não devolveu sessão (HTTP ${verificar.status}).`)
  await gravar(nav, escolhidas.filter((c) => !c.publica), 'sessao', async (p) => {
    await p.goto(`${SITE}/login#${fragmento}`, { waitUntil: 'load' })
    await p.waitForFunction(() => Object.keys(sessionStorage).some((k) => k.startsWith('sb-')), null, { timeout: 20_000 })
    await p.goto(`${SITE}/inicio`, { waitUntil: 'load' })
    await p.waitForURL((u) => !u.pathname.startsWith('/inicio') && !u.pathname.startsWith('/login'), { timeout: 20_000 })
    if (new URL(p.url()).pathname.startsWith('/seletor')) {
      await p.getByText(roteiro.unidade_inicial, { exact: true }).click()
      await p.waitForURL((u) => !u.pathname.startsWith('/seletor'), { timeout: 20_000 })
    }
    await espera(p, 1500)
  })
} finally {
  await nav?.close()
  await admin('PUT', `users/${COORDENADORA}`, { ban_duration: '876000h' })
  console.log('Conta da coordenadora bloqueada de novo.')
}
