// Gera o PDF da matriz competitiva (A4 paisagem, uso interno) e uma imagem por página para conferência.
// Uso (da raiz do repositório): node docs/comercial/matriz/gerar-pdf.mjs <saida.pdf>
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const { chromium } = require('playwright-core')
const pasta = dirname(fileURLToPath(import.meta.url))
const saida = process.argv[2] ?? join(pasta, 'matriz-competitiva-interna.pdf')
// o mascote vem da página de entrada
const mascote = join(pasta, 'coruja.webp')
if (!existsSync(mascote)) copyFileSync(new URL('../../../public/landing/coruja.webp', import.meta.url), mascote)
const nav = await chromium.launch({ executablePath: process.env.NAVEGADOR ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
const p = await nav.newPage()
await p.goto(pathToFileURL(join(pasta, 'matriz.html')).href, { waitUntil: 'load' })
await p.pdf({ path: saida, format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true })
// conferência: cada página como imagem, no tamanho da folha
await p.setViewportSize({ width: 1123, height: 794 })
await p.emulateMedia({ media: 'print' })
const paginas = await p.$$('section.pag')
for (const [i, s] of paginas.entries()) await s.screenshot({ path: saida.replace(/\.pdf$/, `-p${i + 1}.png`) })
await nav.close()
console.log(`PDF: ${saida} (${paginas.length} páginas)`)
