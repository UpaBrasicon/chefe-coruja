// Tira um quadro de cada bloco (no ponto pedido da duração) para conferir.
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const { chromium } = require('playwright-core')
const frac = Number(process.argv[2] ?? 0.8)
const so = process.argv[3] ? process.argv[3].split(',').map(Number) : null
const txt = readFileSync('assets/blocos.js', 'utf8')
const blocos = JSON.parse(txt.match(/window.BLOCOS = (.*);\nwindow/s)[1])
mkdirSync('previa', { recursive: true })
const nav = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
const p = await nav.newPage({ viewport: { width: 1920, height: 1080 } })
await p.goto(pathToFileURL(resolve('video.html')).href, { waitUntil: 'load' })
for (const b of blocos) {
  if (so && !so.includes(b.fala)) continue
  const t = b.ini + b.dur * frac
  await p.evaluate(async (t) => { await window.renderizar(t) }, t)
  await p.screenshot({ path: `previa/b${String(b.fala).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 })
}
await nav.close()
console.log('ok')
