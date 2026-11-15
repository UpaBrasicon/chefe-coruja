// Backlog comercial, item 8: monta o vídeo de venda NARRADO, com música.
//
// Lê a gravação (sessao*.json, do gravar-video.mjs), a lista de cenas
// (cenas.json) e a narração (narracao.json). Para cada cena:
//   • gera a fala com voz neural (edge-tts, decisão N1 = A do RT);
//   • ajusta o trecho gravado à duração da fala (acelera até 1,7× ou segura o
//     último quadro), sem zoom: o zoompan tremia a imagem (reclamação do RT, 15/11/2026);
//   • põe a legenda curta com a palavra-chave e o selo de dados fictícios.
// Depois junta as cenas com transições, põe a trilha gerada por código
// (trilha.py, M1 = B) e abaixa a música quando a voz fala.
//
// Uso (da raiz do repositório):
//   FFMPEG=".../ffmpeg.exe" node scripts/demo/montar-narrado.mjs \
//     docs/comercial/video/cenas.json docs/comercial/video/narracao.json tmp/video [saida.mp4]
// Precisa do Python com o pacote edge-tts (o texto da narração vai ao serviço de voz da Microsoft).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [arqCenas, arqNarr, pasta = join('tmp', 'video'), arqSaida] = process.argv.slice(2)
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const FFPROBE = FFMPEG.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1')
const PY = process.env.PYTHON ?? 'python'
const FONTE = 'C:/Windows/Fonts/seguisb.ttf'
const FONTE_TITULO = 'C:/Windows/Fonts/segoeuib.ttf'
const LOGO = 'public/landing/coruja.webp'
const T = 0.45 // transição entre cenas, em segundos
const saida = arqSaida ?? join(pasta, 'chefe-coruja-video-narrado.mp4')
const roteiro = JSON.parse(readFileSync(arqCenas, 'utf8'))
const narr = JSON.parse(readFileSync(arqNarr, 'utf8'))
const trab = join(pasta, 'narrado')
mkdirSync(trab, { recursive: true })

const marcas = new Map()
const sessoes = readdirSync(pasta).filter((f) => /^sessao.*\.json$/.test(f)).sort((a, b) => (a === 'sessao.json' ? -1 : b === 'sessao.json' ? 1 : a.localeCompare(b)))
for (const f of sessoes) for (const m of JSON.parse(readFileSync(join(pasta, f), 'utf8')).marcas) if (!m.erro) marcas.set(m.n, { ...m, video: JSON.parse(readFileSync(join(pasta, f), 'utf8')).video })

const esc = (c) => resolve(c).replace(/\\/g, '/').replace(/:/g, '\\:')
const ff = (args) => execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] })
const duracao = (arq) => Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq], { encoding: 'utf8' }).trim())
const texto = (nome, t) => { const c = join(trab, nome); writeFileSync(c, t, 'utf8'); return esc(c) }
const selo = texto('selo.txt', 'Pacientes e equipe fictícios')

const partes = []
for (const cena of narr.cenas) {
  const id = String(cena.n).padStart(2, '0')
  // fala
  const audio = join(trab, `fala-${id}.mp3`)
  if (!existsSync(audio)) {
    execFileSync(PY, ['-m', 'edge_tts', '--voice', narr.voz, `--rate=${narr.ritmo}`, '--text', cena.fala, '--write-media', audio], { stdio: ['ignore', 'ignore', 'inherit'] })
  }
  const dFala = duracao(audio)
  let D = Math.max(2.8, dFala + (cena.cartela ? 0.9 : 0.55))
  // a cena pode passar da fala (até 3 s) para a ação gravada caber sem correr demais
  const gravada = !cena.cartela && marcas.get(cena.n) && marcas.get(cena.ate ?? cena.n)
  if (gravada) D = Math.min(Math.max(D, (marcas.get(cena.ate ?? cena.n).fim - marcas.get(cena.n).ini) / 1.25), D + 3)
  const video = join(trab, `cena-${id}.mp4`)
  if (cena.cartela) {
    const c = narr[cena.cartela]
    const tit = texto(`t${id}.txt`, c.titulo)
    const sub = texto(`s${id}.txt`, c.subtitulo)
    const logo = cena.cartela === 'fechamento'
    const filtros = [
      `[0:v]drawtext=fontfile='${FONTE_TITULO.replace(/:/g, '\\:')}':textfile='${tit}':fontcolor=white:fontsize=${logo ? 84 : 72}:x=(w-tw)/2:y=h/2+${logo ? 50 : -60}:alpha='min(1,t/0.5)',` +
      `drawtext=fontfile='${FONTE.replace(/:/g, '\\:')}':textfile='${sub}':fontcolor=0x7dd3fc:fontsize=44:x=(w-tw)/2:y=h/2+${logo ? 165 : 50}:alpha='if(lt(t,${logo ? 0.6 : 1.6}),0,min(1,(t-${logo ? 0.6 : 1.6})/0.5))'[fundo]`,
    ]
    const entradas = ['-f', 'lavfi', '-i', `color=c=0x0b1220:s=1920x1080:r=30:d=${D.toFixed(2)}`]
    if (logo && existsSync(LOGO)) {
      entradas.push('-loop', '1', '-t', D.toFixed(2), '-i', LOGO)
      filtros.push('[1:v]scale=-1:300,format=rgba[logo]', '[fundo][logo]overlay=(W-w)/2:H/2-320[v]')
    } else filtros.push('[fundo]null[v]')
    ff([...entradas, '-filter_complex', filtros.join(';'), '-map', '[v]', '-t', D.toFixed(2), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '18', video])
  } else {
    const m = marcas.get(cena.n)
    const mFim = marcas.get(cena.ate ?? cena.n)
    if (!m || !mFim) { console.error(`Cena ${cena.n} sem gravação: pulada.`); continue }
    const real = Math.max(0.5, mFim.fim - m.ini)
    const fator = Math.min(Math.max(real / D, 1), 1.7)
    const sobra = Math.max(0, D - real / fator)
    const leg = texto(`l${id}.txt`, cena.legenda)
    const vf = [
      `setpts=(PTS-STARTPTS)/${fator.toFixed(4)}`,
      'fps=30,scale=1920:1080:flags=lanczos',
      ...(sobra > 0 ? [`tpad=stop_mode=clone:stop_duration=${sobra.toFixed(2)}`] : []),
      `drawtext=fontfile='${FONTE_TITULO.replace(/:/g, '\\:')}':textfile='${leg}':fontcolor=white:fontsize=54:box=1:boxcolor=0x0e7490@0.93:boxborderw=26:x=96:y=h-190:alpha='if(lt(t,0.25),0,min(1,(t-0.25)/0.3))'`,
      `drawtext=fontfile='${FONTE.replace(/:/g, '\\:')}':textfile='${selo}':fontcolor=white@0.9:fontsize=24:box=1:boxcolor=0x0b1220@0.7:boxborderw=12:x=w-tw-36:y=h-th-26`,
      `trim=duration=${D.toFixed(3)}`,
    ].join(',')
    ff(['-ss', m.ini.toFixed(2), '-t', real.toFixed(2), '-i', m.video, '-vf', vf, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '18', '-preset', 'veryfast', video])
  }
  partes.push({ n: cena.n, video, audio, D: duracao(video), dFala })
  console.log(`cena ${cena.n}: fala ${dFala.toFixed(1)} s, cena ${partes.at(-1).D.toFixed(1)} s`)
}

// junção com transições e a posição de cada fala no tempo final
const entradas = []
const fv = []
let acumulado = partes[0].D
const inicios = [0]
partes.forEach((p) => entradas.push('-i', p.video))
let ant = '[0:v]'
for (let i = 1; i < partes.length; i++) {
  const offset = acumulado - T
  inicios.push(offset)
  const tipo = i === 1 || i === partes.length - 1 ? 'fade' : 'smoothleft'
  fv.push(`${ant}[${i}:v]xfade=transition=${tipo}:duration=${T}:offset=${offset.toFixed(3)}[x${i}]`)
  ant = `[x${i}]`
  acumulado = offset + partes[i].D
}
const total = acumulado
const so = join(trab, 'so-video.mp4')
ff([...entradas, '-filter_complex', fv.join(';'), '-map', ant, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '18', '-preset', 'medium', so])

// trilha e narração
const trilha = join(trab, 'trilha.wav')
execFileSync(PY, ['-I', 'scripts/demo/trilha.py', (total + 1).toFixed(1), trilha], { stdio: ['ignore', 'inherit', 'inherit'] })
const ea = ['-i', so, '-i', trilha]
const fa = []
partes.forEach((p, i) => {
  ea.push('-i', p.audio)
  const atraso = Math.round((inicios[i] + 0.25) * 1000)
  fa.push(`[${i + 2}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${atraso}|${atraso},apad=whole_dur=${total.toFixed(2)}[f${i}]`)
})
fa.push(`${partes.map((_, i) => `[f${i}]`).join('')}amix=inputs=${partes.length}:normalize=0,volume=1.0,asplit=2[voz][chave]`)
fa.push(`[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.55,afade=t=in:d=1.5,afade=t=out:st=${(total - 3).toFixed(2)}:d=3[mus]`)
fa.push('[mus][chave]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450:makeup=1[musbaixa]')
fa.push('[musbaixa][voz]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]')
ff([...ea, '-filter_complex', fa.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(2), '-movflags', '+faststart', saida])
console.log(`Vídeo narrado: ${saida} (${total.toFixed(1)} s)`)
