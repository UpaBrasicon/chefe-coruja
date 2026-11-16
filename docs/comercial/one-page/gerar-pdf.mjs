// Gera o PDF A4 e uma imagem de conferência da one-page.
// Uso (da raiz do repositório): node docs/comercial/one-page/gerar-pdf.mjs <saida.pdf>
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const { chromium } = require('playwright-core')
const pasta = dirname(fileURLToPath(import.meta.url))
const saida = process.argv[2] ?? join(pasta, 'chefe-coruja-one-page.pdf')
// o mascote vem da página de entrada
const mascote = join(pasta, 'coruja.webp')
if (!existsSync(mascote)) copyFileSync(new URL('../../../public/landing/coruja.webp', import.meta.url), mascote)
const nav = await chromium.launch({ executablePath: process.env.NAVEGADOR ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
const p = await nav.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 })
await p.goto(pathToFileURL(join(pasta, 'one-page.html')).href, { waitUntil: 'load' })
await p.pdf({ path: saida, format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } })
await p.screenshot({ path: saida.replace(/\.pdf$/, '.png'), fullPage: false })
const transborda = await p.evaluate(() => document.querySelector('.pagina').scrollHeight > document.querySelector('.pagina').clientHeight)
await nav.close()
console.log(`PDF: ${saida}${transborda ? ' — ATENÇÃO: o conteúdo passa de uma página' : ''}`)
