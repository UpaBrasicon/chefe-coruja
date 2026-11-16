// Backlog comercial, item 8: monta o vídeo de venda a partir da gravação.
//
// Lê o roteiro (cenas.json) e as marcas da gravação (sessao.json, do
// gravar-video.mjs); corta cada cena, acelera de leve a que passou do tempo,
// põe a legenda, faz as cartelas de abertura e fechamento e junta tudo num
// MP4 1920 × 1080, 30 quadros por segundo.
//
// Uso (da raiz do repositório):
//   FFMPEG="C:/Users/<você>/tools/ffmpeg/.../bin/ffmpeg.exe" \
//     node scripts/demo/montar-video.mjs docs/comercial/video/cenas.json tmp/video [tmp/video/chefe-coruja-video.mp4]
// Gravações parciais (sessao-3-4.json, do SO_CENAS) substituem as cenas
// correspondentes da sessão inteira.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [arqCenas, pasta = join('tmp', 'video'), arqSaida] = process.argv.slice(2)
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const FONTE = process.env.FONTE ?? 'C:/Windows/Fonts/seguisb.ttf'
const FONTE_TITULO = process.env.FONTE_TITULO ?? 'C:/Windows/Fonts/segoeuib.ttf'
const LOGO = process.env.LOGO ?? 'public/landing/coruja.webp'
const saida = arqSaida ?? join(pasta, 'chefe-coruja-video.mp4')
const roteiro = JSON.parse(readFileSync(arqCenas, 'utf8'))
const trab = join(pasta, 'partes')
mkdirSync(trab, { recursive: true })

// marcas: a sessão inteira e, por cima, as regravações parciais
const marcas = new Map()
const sessoes = readdirSync(pasta).filter((f) => /^sessao.*\.json$/.test(f)).sort((a, b) => (a === 'sessao.json' ? -1 : b === 'sessao.json' ? 1 : a.localeCompare(b)))
for (const f of sessoes) {
  const s = JSON.parse(readFileSync(join(pasta, f), 'utf8'))
  for (const m of s.marcas) if (!m.erro) marcas.set(m.n, { ...m, video: s.video })
}

const esc = (c) => c.replace(/\\/g, '/').replace(/:/g, '\\:')
const ff = (args) => execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] })
const textoArq = (nome, texto) => { const c = resolve(trab, nome); writeFileSync(c, texto, 'utf8'); return esc(c) }

const partes = []
for (const cena of roteiro.cenas) {
  if (cena.oculta) continue // passagem gravada que não entra no vídeo (troca de unidade)
  const parte = join(trab, `cena-${String(cena.n).padStart(2, '0')}.mp4`)
  const dur = cena.duracao
  if (cena.cartela) {
    const titulo = textoArq(`t${cena.n}.txt`, cena.titulo)
    const sub = textoArq(`s${cena.n}.txt`, cena.subtitulo ?? '')
    const temLogo = existsSync(LOGO)
    const filtros = [
      `[0:v]drawtext=fontfile='${esc(FONTE_TITULO)}':textfile='${titulo}':fontcolor=white:fontsize=76:x=(w-tw)/2:y=h/2+40,` +
      `drawtext=fontfile='${esc(FONTE)}':textfile='${sub}':fontcolor=0x7dd3fc:fontsize=40:x=(w-tw)/2:y=h/2+150,` +
      `fade=t=in:st=0:d=0.5,fade=t=out:st=${dur - 0.6}:d=0.6[fundo]`,
    ]
    const entradas = ['-f', 'lavfi', '-i', `color=c=0x0b1220:s=1920x1080:r=30:d=${dur}`]
    if (temLogo) {
      entradas.push('-loop', '1', '-t', String(dur), '-i', LOGO) // imagem parada repetida, para o fade valer
      filtros.push(`[1:v]scale=-1:300,format=rgba,fade=t=in:st=0:d=0.5:alpha=1[logo]`, `[fundo][logo]overlay=(W-w)/2:H/2-330[v]`)
    } else filtros.push('[fundo]null[v]')
    ff([...entradas, '-filter_complex', filtros.join(';'), '-map', '[v]', '-t', String(dur), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '20', parte])
  } else {
    const m = marcas.get(cena.n)
    if (!m) { console.error(`Cena ${cena.n} sem gravação: pulada.`); continue }
    // corte: segundos do começo da cena que não entram (carregamento da tela)
    const ini = m.ini + (cena.corte ?? 0)
    const real = Math.max(0.5, m.fim - ini)
    const fator = real > dur * 1.15 ? Math.min(real / dur, 2.2) : 1 // acelera no máximo 2,2×
    const final = real / fator
    const leg = textoArq(`l${cena.n}.txt`, cena.legenda)
    const selo = textoArq('selo.txt', 'Pacientes e equipe fictícios')
    const vf = [
      `setpts=(PTS-STARTPTS)/${fator.toFixed(4)}`,
      'scale=1920:1080:flags=lanczos,fps=30',
      `drawtext=fontfile='${esc(FONTE)}':textfile='${leg}':fontcolor=white:fontsize=46:box=1:boxcolor=0x0b1220@0.78:boxborderw=26:x=(w-tw)/2:y=h-th-74`,
      ...(cena.publica ? [] : [`drawtext=fontfile='${esc(FONTE)}':textfile='${selo}':fontcolor=white@0.92:fontsize=24:box=1:boxcolor=0x0b1220@0.7:boxborderw=12:x=w-tw-36:y=h-th-26`]),
      `fade=t=in:st=0:d=0.35,fade=t=out:st=${Math.max(0, final - 0.35).toFixed(2)}:d=0.35`,
    ].join(',')
    ff(['-ss', ini.toFixed(2), '-t', real.toFixed(2), '-i', m.video, '-vf', vf, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '20', parte])
    console.log(`cena ${cena.n}: ${real.toFixed(1)} s gravados, ${final.toFixed(1)} s no vídeo${fator > 1 ? ` (${fator.toFixed(2)}×)` : ''}`)
  }
  partes.push(parte)
}

const lista = join(trab, 'lista.txt')
writeFileSync(lista, partes.map((c) => `file '${resolve(c).replace(/\\/g, '/')}'`).join('\n'), 'utf8')
ff(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', saida])
console.log(`Vídeo montado: ${saida}`)
