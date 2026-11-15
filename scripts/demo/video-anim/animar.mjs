// Renderiza uma página de animação (window.renderizar(t)) quadro a quadro e
// monta o MP4 com narração e trilha. Uso: node animar.mjs <pagina.html> <segundos> <saida.mp4> <falas.json>
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../../package.json', import.meta.url))
const { chromium } = require('playwright-core')
const [pagina, segundos, saida, arqFalas] = process.argv.slice(2)
const FFMPEG = process.env.FFMPEG
const FPS = 30
const pasta = join(dirname(resolve(saida)), 'quadros-anim')
rmSync(pasta, { recursive: true, force: true }); mkdirSync(pasta, { recursive: true })

const nav = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
const p = await nav.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await p.goto(pathToFileURL(resolve(pagina)).href, { waitUntil: 'load' })
await p.evaluate(() => document.fonts.ready)
const N = Math.round(Number(segundos) * FPS)
for (let i = 0; i < N; i++) {
  await p.evaluate(async (t) => { await window.renderizar(t) }, i / FPS)
  await p.screenshot({ path: join(pasta, `q${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
  if (i % 90 === 0) console.log(`quadro ${i}/${N}`)
}
await nav.close()

const video = join(pasta, 'so-video.mp4')
execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(pasta, 'q%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', video])

// narração e trilha (a música abaixa quando a voz fala)
const falas = JSON.parse(readFileSync(arqFalas, 'utf8'))
const args = ['-i', video, '-i', falas.trilha]
const fa = []
falas.itens.forEach((f, i) => {
  args.push('-i', f.audio)
  const ms = Math.round(f.em * 1000)
  fa.push(`[${i + 2}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms},apad=whole_dur=${segundos}[f${i}]`)
})
fa.push(`${falas.itens.map((_, i) => `[f${i}]`).join('')}amix=inputs=${falas.itens.length}:normalize=0,asplit=2[voz][chave]`)
fa.push(`[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.55,afade=t=in:d=1,afade=t=out:st=${Number(segundos) - 2}:d=2[mus]`)
fa.push('[mus][chave]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450[mb]')
fa.push('[mb][voz]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]')
execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args, '-filter_complex', fa.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', segundos, '-movflags', '+faststart', saida])
console.log(`Trecho: ${saida}`)
