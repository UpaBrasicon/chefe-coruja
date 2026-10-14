// Gera biblioteca/corpus/<ficha>.md a partir do pacote clínico (src/clinico):
// um arquivo por ficha, com título, público, fontes (citação com página),
// rota na Central e os dados que a tela usa (tabelas de dose, itens de escore,
// faixas). É conteúdo do próprio Chefe Coruja (licença institucional) — não é
// o texto dos livros. A biblioteca cita "Central do Plantonista — <ferramenta>"
// e, dentro, a fonte com página que a ficha declara.
//
// Cada seção leva o comentário /** ... */ que o código traz acima da constante
// ou da função (texto com unidade e página) e o bloco do arquivo (as linhas
// "// ---- insulina (p. 521–522)"): sem isso a IA via só "INSULINA_EHH: faixa
// 0.025, 0.05" e confundia a insulina do EHH com a da CAD (R2-14, Portão 2,
// tarefa 1b). SEPARAR divide uma ficha em mais de um arquivo por bloco.
// Uso: node --experimental-strip-types scripts/corpus-central.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const raiz = join(import.meta.dirname, '..')
const destino = join(raiz, 'biblioteca/corpus')
rmSync(destino, { recursive: true, force: true })
mkdirSync(destino, { recursive: true })
const { ROTA_DA_FICHA } = await import(pathToFileURL(join(raiz, 'src/clinico/indice.ts')).href)

const IGNORAR = /\.test\.ts$|^fonte.*\.ts$|^ficha\.ts$|^escore\.ts$|^indice\.ts$|^index\.ts$/
const arquivos = []
for (const pasta of ['', 'adulto', 'pediatria', 'escores']) {
  const dir = join(raiz, 'src/clinico', pasta)
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts') || IGNORAR.test(f) || statSync(join(dir, f)).isDirectory()) continue
    arquivos.push(join(dir, f))
  }
}

// Fichas que viram mais de um arquivo: as seções do bloco `banner` vão para a
// parte; o resto fica no arquivo principal, com o título novo. O texto e as
// páginas são os mesmos da ficha.
const SEPARAR = {
  'ped-cad-ehh': {
    titulo: 'Cetoacidose diabética (CAD) — criança',
    partes: [{ id: 'ped-cad-ehh-ehh', titulo: 'Estado hiperosmolar hiperglicêmico (EHH) — criança', banner: /^EHH\b/ }],
  },
}

/** Comentário /** *\/ e bloco "// ----" de cada export, na ordem do arquivo. */
function lerExports(arq) {
  const src = readFileSync(arq, 'utf8')
  const out = []
  let banner = ''
  const re = /\/\*\*([\s\S]*?)\*\/\s*$|^\/\/ -{8,}\s*(.+)$|^export (?:async )?(?:const|function) (\w+)/gm
  let doc = null
  let fimDoc = -1
  for (const m of src.matchAll(re)) {
    if (m[1] !== undefined) {
      doc = m[1].split(/\r?\n/).map((l) => l.replace(/^\s*\*\s?/, '').trim()).filter(Boolean).join(' ')
      fimDoc = m.index + m[0].length
    } else if (m[2] !== undefined) {
      banner = m[2].replace(/^[/\s]+|[-\s]+$/g, '')
      doc = null
    } else {
      // o comentário vale só quando está logo acima do export
      const colado = doc && src.slice(fimDoc, m.index).trim() === ''
      out.push({ nome: m[3], doc: colado ? doc : '', banner })
      doc = null
    }
  }
  return out
}

// Ficha que divide o arquivo com outras sem nome que as separe: leva só os
// blocos "// ----" indicados, e as outras fichas do arquivo não os levam
// (avaliação de 14/10/2026: adulto/glicemia.ts tem CAD e hipoglicemia, e a
// ficha da hipoglicemia só trazia CAD).
const BLOCOS_DA_FICHA = {
  'adulto-hipoglicemia': /^hipoglicemia\b/i,
}

const ehFicha = (v) => v && typeof v === 'object' && typeof v.id === 'string' && typeof v.versao === 'string' && Array.isArray(v.fontes)
const escapar = (s) => String(s).replace(/\r?\n/g, ' ').trim()

/** Valor → texto legível (sem JSON cru). */
function texto(v, nivel = 0) {
  if (v == null) return ''
  if (typeof v === 'function') return ''
  if (typeof v !== 'object') return escapar(v)
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== 'object' || x == null)) return v.map(escapar).join(', ')
    return v.map((x) => `- ${texto(x, nivel + 1)}`).join('\n')
  }
  const pares = []
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === 'function' || x == null || k === 'ficha') continue
    if (typeof x === 'object' && !Array.isArray(x)) pares.push(`${k}: (${texto(x, nivel + 1).replace(/\n/g, ' ')})`)
    else if (Array.isArray(x) && x.some((y) => typeof y === 'object' && y != null))
      pares.push(`${k}:\n${texto(x, nivel + 1).split('\n').map((l) => '  ' + l).join('\n')}`)
    else pares.push(`${k}: ${texto(x, nivel + 1)}`)
  }
  return pares.join(nivel === 0 ? '\n' : '; ')
}

let gerados = 0
for (const arq of arquivos) {
  const mod = await import(pathToFileURL(arq).href)
  const ordem = lerExports(arq)
  const fichas = []
  const dados = []
  for (const [nome, v] of Object.entries(mod)) {
    if (ehFicha(v)) fichas.push([nome, v])
    else if (ehFicha(v?.ficha)) fichas.push([nome, v.ficha, v])
    else if (v && typeof v !== 'function') dados.push([nome, v])
  }
  if (!fichas.length) continue
  for (const [nome, ficha, dono] of fichas) {
    const rota = ROTA_DA_FICHA[ficha.id]
    const publico = { adulto: 'adulto (14 anos ou mais)', pediatrico: 'pediátrico (até antes dos 14 anos)', ambos: 'adulto e pediátrico' }[ficha.publico] ?? ficha.publico
    const fontes = ficha.fontes.map((f) => f.citacao + (f.pediatrica ? ' (fonte pediátrica)' : '')).join(' · ')
    const blocos = dono ? [[nome, dono]] : dados.filter(([n]) => fichas.length === 1 || n.toLowerCase().includes(ficha.id.replace(/-/g, '').slice(0, 6)))
    const usados = new Map(blocos.length ? blocos : dados)
    const daFicha = (n) => dono ? n === nome : fichas.length === 1 || n.toLowerCase().includes(ficha.id.replace(/-/g, '').slice(0, 6))
    const meus = BLOCOS_DA_FICHA[ficha.id]
    const deOutra = fichas.map(([, f]) => BLOCOS_DA_FICHA[f.id]).filter((r) => r && r !== meus)
    const temBloco = Boolean(meus)
    const noBloco = (b) => (meus ? meus.test(b) : !deOutra.some((r) => r.test(b)))
    // seções na ordem do arquivo: dado (comentário + valores) ou função com comentário (só o texto)
    const secoes = []
    const vistos = new Set()
    for (const e of ordem) {
      const v = usados.get(e.nome)
      const corpo = [e.doc, v !== undefined ? texto(v) : ''].filter(Boolean).join('\n')
      vistos.add(e.nome)
      if (!noBloco(e.banner)) continue
      const doBloco = temBloco && typeof mod[e.nome] === 'function'
      if (!corpo || (v === undefined && (!e.doc || typeof mod[e.nome] !== 'function' || !(doBloco || daFicha(e.nome))))) continue
      secoes.push({ nome: e.nome, banner: e.banner, corpo })
    }
    for (const [n, v] of usados) {
      const corpo = vistos.has(n) || temBloco ? '' : texto(v)
      if (corpo) secoes.push({ nome: n, banner: '', corpo })
    }
    const sep = SEPARAR[ficha.id]
    const arquivosDaFicha = sep
      ? [{ id: ficha.id, titulo: sep.titulo, secoes: secoes.filter((x) => !sep.partes.some((p) => p.banner.test(x.banner))) },
         ...sep.partes.map((p) => ({ id: p.id, titulo: p.titulo, secoes: secoes.filter((x) => p.banner.test(x.banner)) }))]
      : [{ id: ficha.id, titulo: ficha.titulo, secoes }]
    for (const a of arquivosDaFicha) {
      const outras = arquivosDaFicha.filter((o) => o !== a).map((o) => `"${o.titulo}"`)
      const linhas = [
        '---',
        `titulo: ${JSON.stringify(a.titulo)}`,
        `ficha: ${a.id}`,
        `versao: ${ficha.versao}`,
        `publico: ${JSON.stringify(publico)}`,
        `fontes: ${JSON.stringify(fontes)}`,
        `rota: ${JSON.stringify(rota ?? '')}`,
        '---',
        `# ${a.titulo}`,
        '',
        `Ferramenta da Central do Plantonista (Chefe Coruja). Público: ${publico}. Versão ${ficha.versao}, revisada em ${ficha.revisadoEm}.`,
        `Fonte declarada pela ficha: ${fontes}.`,
        outras.length ? `Esta parte trata só de ${a.titulo.split(' — ')[0]}. A mesma ferramenta da Central ("${ficha.titulo}") tem também: ${outras.join(', ')}.` : '',
        rota ? `Abrir na Central: ${rota}.` : '',
        '',
      ]
      for (const x of a.secoes) {
        linhas.push(`## ${a.titulo} — ${x.banner ? `${x.banner} — ` : ''}${x.nome}`, '', x.corpo, '')
      }
      const md = linhas.join('\n')
      writeFileSync(join(destino, `${a.id}.md`), md.length > 60000 ? md.slice(0, 60000) + '\n…' : md)
      gerados++
    }
  }
}
console.log(`${gerados} arquivos em biblioteca/corpus`)
