// Prepara o vídeo em blocos: mede as falas, monta a linha do tempo, extrai os
// quadros dos trechos gravados e grava assets/blocos.js e falas-video.json.
// Uso: FFMPEG=... node preparar.mjs <blocos.json> <narracao.json> <pasta-gravacoes> <pasta-falas>
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const [arqBlocos, arqNarr, pastaGrav, pastaFalas] = process.argv.slice(2)
const FFMPEG = process.env.FFMPEG
const FFPROBE = FFMPEG.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1')
const T = 0.4
const blocos = JSON.parse(readFileSync(arqBlocos, 'utf8')).blocos
const narr = JSON.parse(readFileSync(arqNarr, 'utf8'))
const fala = Object.fromEntries(narr.cenas.map((c) => [c.n, c.fala]))
const dur = (a) => Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a], { encoding: 'utf8' }).trim())

let ini = 0
const itens = []
for (const b of blocos) {
  const audio = resolve(pastaFalas, `fala-${String(b.fala).padStart(2, '0')}.mp3`)
  if (!existsSync(audio)) execFileSync('python', ['-m', 'edge_tts', '--voice', narr.voz, `--rate=${narr.ritmo}`, '--text', fala[b.fala], '--write-media', audio])
  const d = dur(audio)
  b.dur = Math.max(3.6, d + (b.tipo === 'abertura' ? 1.9 : b.tipo === 'fechamento' ? 1.6 : 0.8))
  b.ini = ini
  itens.push({ audio: audio.replace(/\\/g, '/'), em: ini + 0.3 })
  if (b.tipo === 'clipe') {
    const [arq, de, ate] = b.clipe
    const pasta = `clipe-${b.fala}`
    const destino = join('assets', pasta)
    mkdirSync(destino, { recursive: true })
    if (!existsSync(join(destino, '0001.jpg'))) {
      execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(de), '-t', String(ate - de), '-i', join(pastaGrav, arq), '-vf', 'fps=30', '-q:v', '4', join(destino, '%04d.jpg')])
    }
    b.quadros = { pasta, n: Math.round((ate - de) * 30) - 1 }
  }
  ini += b.dur - T
}
const total = ini + T
writeFileSync(join('assets', 'blocos.js'), `window.BLOCOS = ${JSON.stringify(blocos)};\nwindow.TOTAL = ${total.toFixed(3)};\n`)
writeFileSync('falas-video.json', JSON.stringify({ trilha: resolve('trilha-video.wav').replace(/\\/g, '/'), itens }, null, 1))
execFileSync('python', ['-I', fileURLToPath(new URL('../trilha.py', import.meta.url)), (total + 1).toFixed(1), 'trilha-video.wav'])
console.log(`Blocos: ${blocos.length}; duração ${total.toFixed(1)} s`)
