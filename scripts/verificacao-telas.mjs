// Verificação das telas no render real (onda 10 do porte do frontend).
//
// Porte de `P/tools/verificacao/` (verif.mjs, fundo.mjs, sticky.mjs) para o
// app: entra com cada papel de teste, percorre as telas do menu lateral e mede,
// no navegador, o que a leitura do código não pega:
//
//   • CONTRASTE  texto × fundo real (compõe os fundos translúcidos dos
//                ancestrais), WCAG AA: 4,5:1, ou 3:1 para texto grande.
//   • FOCO       Tab de verdade (teclado, não .focus()): o elemento focado tem
//                anel visível? O anel tem 3:1 contra o fundo? Foco que cai em
//                elemento invisível. Botão e link sem nome acessível.
//   • TRANSBORDO rolagem horizontal da página e elementos que passam da borda
//                direita sem estar num contêiner que rola ou recorta.
//   • STICKY     depois de rolar a página, o que é `position: sticky` (topo,
//                faixa do papel, cabeçalhos de tabela) continua na vista
//                enquanto o bloco dele está na vista.
//
// Uso (app no ar em http://localhost:5199 com o banco local e o seed):
//   npm run verificar:telas
//   node scripts/verificacao-telas.mjs --papeis gestor,plantonista --larguras 1280,390
//   node scripts/verificacao-telas.mjs --capturas tmp/capturas --json tmp/verificacao.json
//
// Opções: --url (padrão http://localhost:5199), --papeis (padrão: os seis),
// --larguras (padrão 1280,390), --max-telas N por papel, --capturas <pasta>,
// --json <arquivo>, --estrito (sai com 1 se achar algo), --sem-check-in. Navegador: EDGE_BIN ou
// CHROME_BIN; sem eles, o Edge do Windows.
//
// Só lê, com uma exceção: o papel de plantão com a tolerância vencida só vê a
// tela de check-in, e o script faz o check-in (com justificativa, no banco
// local) para chegar às telas. --sem-check-in desliga.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const opc = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao
}
const BASE = opc('url', 'http://localhost:5199').replace(/\/$/, '')
const PAPEIS = opc('papeis', 'gestor,admin,plantonista,enfermeiro,recepcao,telemedicina').split(',').map((s) => s.trim()).filter(Boolean)
const LARGURAS = opc('larguras', '1280,390').split(',').map(Number)
const MAX_TELAS = Number(opc('max-telas', '40'))
const CAPTURAS = opc('capturas', null)
const JSON_SAIDA = opc('json', null)
const ESTRITO = args.includes('--estrito')
const SEM_CHECKIN = args.includes('--sem-check-in')
const SENHA = process.env.SENHA_TESTE || 'coruja-teste-local'
const NAVEGADOR = process.env.EDGE_BIN || process.env.CHROME_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const TABS = 30

// ── medições que rodam dentro da página ─────────────────────────────────────

// Funções de cor compartilhadas (string, para injetar em cada medição).
const COR = `
  // Qualquer cor CSS (rgb, oklab, color-mix do Tailwind 4…) → [r, g, b, a] em
  // sRGB, pintando 1 pixel num canvas: o estilo computado não vem só em rgb().
  const cnv = (window.__ccCnv = window.__ccCnv || Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true }))
  const cache = (window.__ccCor = window.__ccCor || new Map())
  const px = (c) => {
    if (!c || c === 'transparent') return null
    if (cache.has(c)) return cache.get(c)
    cnv.clearRect(0, 0, 1, 1); cnv.fillStyle = '#000'; cnv.fillStyle = c; cnv.fillRect(0, 0, 1, 1)
    const d = cnv.getImageData(0, 0, 1, 1).data
    const v = [d[0], d[1], d[2], d[3] / 255]
    cache.set(c, v); return v
  }
  const mist = (f, b) => { const a = f[3] === undefined ? 1 : f[3]; return [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a)) }
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
  const razao = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
  const rgb = (c) => 'rgb(' + c.map(Math.round).join(',') + ')'
  // Fundo real: empilha os fundos dos ancestrais até o primeiro opaco. Se no
  // caminho houver imagem ou degradê, o fundo é indeterminado (null).
  const fundoDe = (el) => {
    let n = el, pilha = []
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
      const c = px(cs.backgroundColor)
      if (c && (c[3] === undefined || c[3] > 0)) pilha.push(c)
      if (c && (c[3] === undefined || c[3] >= 1)) break
      n = n.parentElement
    }
    let base = [255, 255, 255]
    for (let i = pilha.length - 1; i >= 0; i--) base = mist(pilha[i], base)
    return base
  }
`

const CONTRASTE = `(() => { ${COR}
  const falhas = []; let total = 0, indeterminados = 0
  for (const el of document.querySelectorAll('body *')) {
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ')
    if (!txt) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue
    // componente inativo não tem exigência de contraste (WCAG 1.4.3)
    if (el.closest(':disabled, [aria-disabled="true"], [data-disabled]')) continue
    const fg = px(cs.color); if (!fg) continue
    const bg = fundoDe(el)
    if (!bg) { indeterminados++; continue }
    const k = razao(mist(fg, bg), bg)
    const tam = parseFloat(cs.fontSize), peso = parseInt(cs.fontWeight) || 400
    const grande = tam >= 24 || (tam >= 18.66 && peso >= 700)
    const precisa = grande ? 3 : 4.5
    total++
    if (k < precisa - 0.05) falhas.push({ r: +k.toFixed(2), precisa, tam, peso, fg: cs.color, bg: rgb(bg), t: txt.slice(0, 40) })
  }
  return { total, indeterminados, falhas }
})()`

const TRANSBORDO = `(() => {
  const vw = document.documentElement.clientWidth
  const main = document.querySelector('main')
  const ruins = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (r.right <= vw + 1) continue
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed' && (r.left >= vw || r.right <= 0)) continue // fora da tela de propósito (gaveta fechada)
    let a = el.parentElement, contido = false
    while (a && a !== document.body) {
      const ca = getComputedStyle(a)
      // o <main> rola na vertical e por isso o navegador o marca overflow-x:auto;
      // conteúdo que transborda nele é rolagem horizontal da página
      if (a !== main && ['auto', 'scroll', 'hidden', 'clip'].includes(ca.overflowX)) { contido = true; break }
      a = a.parentElement
    }
    if (contido) continue
    // só o mais externo: se o pai também transborda, fica o pai
    const p = el.parentElement && el.parentElement.getBoundingClientRect()
    if (p && p.right > vw + 1 && el.parentElement !== main && el.parentElement !== document.body) continue
    ruins.push({ sobra: Math.round(r.right - vw), tag: el.tagName.toLowerCase(), cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 60),
      txt: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40) })
  }
  const vistos = new Set()
  const unicos = ruins.filter((x) => { const k = x.tag + x.txt + x.sobra; if (vistos.has(k)) return false; vistos.add(k); return true })
  const docRola = document.documentElement.scrollWidth > vw + 1
  const mainRola = !!main && main.scrollWidth > main.clientWidth + 1 && getComputedStyle(main).overflowY !== 'visible'
  return { vw, docRola, mainRola, ruins: unicos.sort((a, b) => b.sobra - a.sobra).slice(0, 6) }
})()`

// Rola o contêiner da página (o <main> no desktop, a janela no celular) e
// confere cada elemento sticky visível.
const STICKY = `(async () => {
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
  const main = document.querySelector('main')
  const usaMain = main && ['auto', 'scroll'].includes(getComputedStyle(main).overflowY) && main.scrollHeight > main.clientHeight + 1
  const rolavel = usaMain || document.documentElement.scrollHeight > window.innerHeight + 1
  const stickies = [...document.querySelectorAll('body *')].filter((el) => {
    if (getComputedStyle(el).position !== 'sticky') return false
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0
  })
  const nome = (el) => el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label') + ']' : '') + ' "' + (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30) + '"'
  if (!rolavel) return { rolou: false, total: stickies.length, falhas: [] }
  const antes = stickies.map((el) => el.getBoundingClientRect().top)
  const passo = 700
  if (usaMain) main.scrollTop = passo; else window.scrollTo(0, passo)
  await pausa(400)
  const topoVista = usaMain ? main.getBoundingClientRect().top : 0
  const falhas = []
  stickies.forEach((el, i) => {
    const r = el.getBoundingClientRect()
    const bloco = el.parentElement.getBoundingClientRect()
    const topoCss = parseFloat(getComputedStyle(el).top)
    // o bloco dele ainda está na vista com folga para o sticky: ele devia estar preso
    if (Number.isNaN(topoCss)) return
    if (bloco.bottom < topoVista + r.height + topoCss + 2) return
    // dentro de um contêiner que não foi o rolado (tabela que rola sozinha etc.)
    let a = el.parentElement, dentro = false
    while (a && a !== document.body && a !== main) {
      const oy = getComputedStyle(a).overflowY
      if (['auto', 'scroll'].includes(oy) && a.scrollHeight > a.clientHeight + 1) { dentro = true; break }
      a = a.parentElement
    }
    if (dentro) return
    const noLugar = r.top >= topoVista - 2 && r.top < window.innerHeight
    if (!noLugar) falhas.push({ el: nome(el), antes: Math.round(antes[i]), depois: Math.round(r.top) })
  })
  if (usaMain) main.scrollTop = 0; else window.scrollTo(0, 0)
  return { rolou: true, total: stickies.length, falhas }
})()`

const SEMANTICA = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  const temNome = (el) => (el.textContent || '').trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.querySelector('img[alt]:not([alt=""])')
  const semNome = [...document.querySelectorAll('button, a[href], [role="button"]')].filter((el) => vis(el) && !temNome(el))
    .map((el) => el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 3).join('.'))
  const campoSemRotulo = [...document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea')].filter((el) => {
    if (!vis(el)) return false
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label')) return false
    if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return false
    return true
  }).map((el) => (el.getAttribute('placeholder') ? 'placeholder "' + el.getAttribute('placeholder') + '"' : el.tagName.toLowerCase() + '#' + (el.id || '?')))
  return { lang: document.documentElement.lang || '(vazio)', semNome: [...new Set(semNome)], campoSemRotulo: [...new Set(campoSemRotulo)] }
})()`

const FOCO_ATUAL = `(() => { ${COR}
  const e = document.activeElement
  if (!e || e === document.body || e === document.documentElement) return null
  const r = e.getBoundingClientRect()
  const cs = getComputedStyle(e)
  const q = ((e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || e.tagName).trim().replace(/\\s+/g, ' ')).slice(0, 30)
  const id = e.tagName.toLowerCase() + ':' + q
  if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden') return { id, q, invisivel: true }
  const bg = fundoDe(e.parentElement || e) || [255, 255, 255]
  let anel = false, contraste = null
  if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) {
    anel = true
    const c = px(cs.outlineColor); if (c) contraste = razao(mist(c, bg), bg)
  } else if (cs.boxShadow && cs.boxShadow !== 'none') {
    // anel por sombra (campos, e o ring do Tailwind): a primeira cor da sombra
    // escolhe, entre as sombras com espalhamento ou desfoque, a de maior contraste
    for (const parte of cs.boxShadow.split(/,(?![^(]*\\))/)) {
      const cor = (parte.match(/^\\s*([a-z]+\\([^)]*\\)|#[0-9a-f]+)/i) || [])[1]
      const nums = parte.replace(/[a-z]+\\([^)]*\\)/gi, '').match(/-?[\\d.]+px/g) || []
      const espalha = nums.length >= 4 ? parseFloat(nums[3]) : 0
      const c = cor && px(cor)
      // anel tem espalhamento; sombra de elevação (só desfoque) não é anel
      if (!c || c[3] === 0 || espalha <= 0) continue
      anel = true
      const k = razao(mist(c, bg), bg)
      if (contraste === null || k > contraste) contraste = k
    }
  }
  return { id, q, anel, contraste: contraste && +contraste.toFixed(2), visivel: e.matches(':focus-visible') }
})()`

// ── percurso ────────────────────────────────────────────────────────────────

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

async function assentar(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  // esqueleto/spinner de carregamento: espera sumir (até 4 s)
  for (let i = 0; i < 20; i++) {
    const carregando = await page.evaluate(() => !!document.querySelector('[aria-busy="true"], .animate-spin, [data-slot="skeleton"]')).catch(() => false)
    if (!carregando) break
    await pausa(200)
  }
  await pausa(500)
}

async function entrar(page, papel) {
  await page.goto(`${BASE}/login`)
  await page.locator('#email').fill(`${papel}@teste.local`)
  await page.locator('#senha').fill(SENHA)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })
  await assentar(page)
  if (new URL(page.url()).pathname.startsWith('/seletor')) {
    await page.locator('main button, button').filter({ hasNotText: /sair/i }).first().click()
    await page.waitForURL((u) => !u.pathname.startsWith('/seletor'), { timeout: 10000 }).catch(() => {})
    await assentar(page)
  }
}

// Papel de plantão (plantonista, enfermagem, recepção) com a tolerância vencida
// só vê a tela de check-in. Faz o check-in (no banco LOCAL) para chegar às
// telas; sem GPS da unidade, vai pela justificativa. --sem-check-in desliga.
async function fazerCheckin(page) {
  // o botão da tela de check-in (a faixa "Fazer check-in" do topo não bloqueia)
  const botao = page.getByRole('button', { name: /Fazer check-in agora/ })
  const justificar = page.getByRole('button', { name: /Registrar com justificativa/ })
  // a casca ou a tela de check-in: o que aparecer primeiro
  await page.waitForSelector('aside.cc-side a[href], main a[href], button:has-text("Fazer check-in agora")', { timeout: 15000 }).catch(() => {})
  if (!(await botao.first().isVisible().catch(() => false))) return true
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    if (await justificar.isVisible().catch(() => false)) {
      await page.locator('textarea').last().fill('Verificação automática de telas (scripts/verificacao-telas.mjs), banco local.')
      await justificar.click()
    } else if (await botao.first().isEnabled().catch(() => false)) {
      await botao.first().click()
    }
    // espera o check-in responder (a casca abre) ou a tela pedir justificativa
    await page.waitForSelector('aside.cc-side a[href], button:has-text("Registrar com justificativa")', { timeout: 12000 }).catch(() => {})
    if (await page.locator('aside.cc-side a[href]').first().isVisible().catch(() => false)) return true
  }
  await page.reload()
  await assentar(page)
  return !(await botao.first().isVisible().catch(() => false))
}

async function telasDoMenu(page) {
  await page.waitForSelector('aside.cc-side a[href]', { timeout: 15000 }).catch(() => {})
  await assentar(page)
  const inicio = new URL(page.url())
  const hrefs = await page.evaluate(() => [...document.querySelectorAll('aside.cc-side a[href], nav a[href]')]
    .map((a) => a.getAttribute('href')).filter((h) => h && h.startsWith('/')))
  const lista = [inicio.pathname + inicio.search, ...hrefs]
    .filter((h) => !/aba=imagens/.test(h))
  return [...new Set(lista)].slice(0, MAX_TELAS)
}

async function percorrerFoco(page) {
  await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.focus() })
  await page.mouse.click(1, 1).catch(() => {})
  const vistos = new Set(), semAnel = [], anelFraco = [], invisiveis = []
  let total = 0
  for (let k = 0; k < TABS; k++) {
    await page.keyboard.press('Tab')
    await pausa(40)
    const r = await page.evaluate(FOCO_ATUAL).catch(() => null)
    if (!r || vistos.has(r.id)) continue
    vistos.add(r.id); total++
    if (r.invisivel) invisiveis.push(r.q)
    else if (!r.anel) semAnel.push(r.q)
    else if (r.contraste !== null && r.contraste < 3) anelFraco.push(`${r.q} (${r.contraste}:1)`)
  }
  await page.keyboard.press('Escape').catch(() => {})
  return { total, semAnel, anelFraco, invisiveis }
}

async function main() {
  if (!fs.existsSync(NAVEGADOR)) {
    console.error(`Navegador não encontrado em ${NAVEGADOR}. Defina EDGE_BIN ou CHROME_BIN.`)
    process.exit(2)
  }
  try { await fetch(BASE) } catch {
    console.error(`O app não respondeu em ${BASE}. Suba com: npm run dev -- --port 5199`)
    process.exit(2)
  }
  if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true })
  const browser = await chromium.launch({ executablePath: NAVEGADOR, headless: true })
  const resultado = { base: BASE, quando: new Date().toISOString(), papeis: {} }
  const contraste = new Map() // fg|bg → grupo
  let achados = 0

  for (const papel of PAPEIS) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', locale: 'pt-BR' })
    const page = await ctx.newPage()
    const rp = { telas: [], erro: null }
    resultado.papeis[papel] = rp
    console.log(`\n══════ ${papel} ══════`)
    try {
      await entrar(page, papel)
    } catch (e) {
      rp.erro = `não entrou: ${e.message.split('\n')[0]}`
      console.log(`  ✖ ${rp.erro}`); achados++
      await ctx.close(); continue
    }
    if (!SEM_CHECKIN && !(await fazerCheckin(page))) {
      rp.erro = 'parado na tela de check-in'
      console.log(`  ✖ ${rp.erro}`); achados++
    }
    const telas = await telasDoMenu(page)
    console.log(`  ${telas.length} telas: ${telas.join('  ')}`)

    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: largura < 768 ? 820 : 900 })
      for (const tela of telas) {
        let reg = { tela, largura }
        let falhasContraste = []
        // a tela pode redirecionar depois de carregar (contexto destruído): tenta de novo
        for (let tentativa = 0; tentativa < 2; tentativa++) {
          reg = { tela, largura }
          try {
            await page.goto(BASE + tela)
            await assentar(page)
            reg.url = new URL(page.url()).pathname
            const c = await page.evaluate(CONTRASTE)
            reg.contraste = { total: c.total, falhas: c.falhas.length, indeterminados: c.indeterminados }
            falhasContraste = c.falhas
            reg.transbordo = await page.evaluate(TRANSBORDO)
            reg.sticky = await page.evaluate(STICKY)
            if (largura >= 1024) {
              reg.foco = await percorrerFoco(page)
              reg.semantica = await page.evaluate(SEMANTICA)
            }
            if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `${papel}${tela.replace(/[/?=&]+/g, '_')}-${largura}.png`), fullPage: true }).catch(() => {})
            break
          } catch (e) {
            reg.erro = e.message.split('\n')[0]
            falhasContraste = []
            if (!/context was destroyed|navigation/i.test(reg.erro)) break
          }
        }
        for (const f of falhasContraste) {
          const k = `${f.fg}|${f.bg}|${f.precisa}`
          const g = contraste.get(k) ?? { ...f, n: 0, telas: new Set() }
          g.n++; g.telas.add(`${papel}${tela}`); contraste.set(k, g)
        }
        rp.telas.push(reg)

        const linhas = []
        if (reg.erro) linhas.push(`erro: ${reg.erro}`)
        const t = reg.transbordo
        if (t && (t.docRola || t.mainRola || t.ruins.length)) {
          linhas.push(`TRANSBORDO${t.docRola ? ' (página rola na horizontal)' : ''}${t.mainRola ? ' (área principal rola na horizontal)' : ''}`)
          for (const r of t.ruins) linhas.push(`   +${r.sobra}px <${r.tag}> "${r.txt}"`)
        }
        for (const f of reg.sticky?.falhas ?? []) linhas.push(`STICKY saiu da vista: ${f.el} (topo ${f.antes} → ${f.depois})`)
        const fo = reg.foco
        if (fo?.semAnel.length) linhas.push(`FOCO sem anel: ${fo.semAnel.slice(0, 5).map((q) => JSON.stringify(q)).join(', ')}`)
        if (fo?.anelFraco.length) linhas.push(`FOCO anel abaixo de 3:1: ${fo.anelFraco.slice(0, 4).join(', ')}`)
        if (fo?.invisiveis.length) linhas.push(`FOCO em elemento invisível: ${fo.invisiveis.slice(0, 4).map((q) => JSON.stringify(q)).join(', ')}`)
        const se = reg.semantica
        if (se?.semNome.length) linhas.push(`SEM NOME acessível: ${se.semNome.slice(0, 4).join(', ')}`)
        if (se?.campoSemRotulo.length) linhas.push(`CAMPO sem rótulo: ${se.campoSemRotulo.slice(0, 4).join(', ')}`)
        if (reg.contraste?.falhas) linhas.push(`CONTRASTE: ${reg.contraste.falhas} de ${reg.contraste.total} textos abaixo do mínimo`)
        achados += linhas.length
        const rotulo = `${String(largura).padStart(4)}px ${tela}${reg.url && reg.url !== tela.split('?')[0] ? ` → ${reg.url}` : ''}`
        console.log(linhas.length ? `  ✖ ${rotulo}\n      ${linhas.join('\n      ')}` : `  ✔ ${rotulo}`)
      }
    }
    await ctx.close()
  }
  await browser.close()

  const grupos = [...contraste.values()].sort((a, b) => b.n - a.n)
  console.log(`\n══════ CONTRASTE (agrupado por cor) ══════`)
  if (!grupos.length) console.log('  nenhum texto abaixo do mínimo')
  for (const g of grupos) {
    const telas = [...g.telas]
    console.log(`  ${g.r}:1 (precisa ${g.precisa})  ${g.fg} sobre ${g.bg}  ×${g.n}  ${g.tam}px/${g.peso}  ex.: "${g.t}"  em ${telas.slice(0, 4).join(', ')}${telas.length > 4 ? ` +${telas.length - 4}` : ''}`)
  }
  resultado.contraste = grupos.map((g) => ({ ...g, telas: [...g.telas] }))
  if (JSON_SAIDA) {
    fs.mkdirSync(path.dirname(path.resolve(JSON_SAIDA)), { recursive: true })
    fs.writeFileSync(JSON_SAIDA, JSON.stringify(resultado, null, 2))
    console.log(`\nRelatório completo: ${JSON_SAIDA}`)
  }
  console.log(`\n>>> ${achados} achado(s) por tela; ${grupos.length} par(es) de cor com contraste baixo`)
  process.exit(ESTRITO && (achados || grupos.length) ? 1 : 0)
}

main().catch((e) => { console.error(e.stack); process.exit(2) })
