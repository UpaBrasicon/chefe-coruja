// Gera biblioteca/corpus/<ficha>.md a partir do pacote clínico (src/clinico):
// um arquivo por ficha, com título, público, fontes (citação com página),
// rota na Central e os dados que a tela usa (tabelas de dose, itens de escore,
// faixas). É conteúdo do próprio Chefe Coruja (licença institucional) — não é
// o texto dos livros. A biblioteca cita "Central do Plantonista — <ferramenta>"
// e, dentro, a fonte com página que a ficha declara.
// Uso: node --experimental-strip-types scripts/corpus-central.mjs
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
    const linhas = [
      '---',
      `titulo: ${JSON.stringify(ficha.titulo)}`,
      `ficha: ${ficha.id}`,
      `versao: ${ficha.versao}`,
      `publico: ${JSON.stringify(publico)}`,
      `fontes: ${JSON.stringify(fontes)}`,
      `rota: ${JSON.stringify(rota ?? '')}`,
      '---',
      `# ${ficha.titulo}`,
      '',
      `Ferramenta da Central do Plantonista (Chefe Coruja). Público: ${publico}. Versão ${ficha.versao}, revisada em ${ficha.revisadoEm}.`,
      `Fonte declarada pela ficha: ${fontes}.`,
      rota ? `Abrir na Central: ${rota}.` : '',
      '',
    ]
    const blocos = dono ? [[nome, dono]] : dados.filter(([n]) => fichas.length === 1 || n.toLowerCase().includes(ficha.id.replace(/-/g, '').slice(0, 6)))
    const usados = blocos.length ? blocos : dados
    for (const [n, v] of usados) {
      const corpo = texto(v)
      if (!corpo) continue
      linhas.push(`## ${ficha.titulo} — ${n}`, '', corpo, '')
    }
    const md = linhas.join('\n')
    writeFileSync(join(destino, `${ficha.id}.md`), md.length > 60000 ? md.slice(0, 60000) + '\n…' : md)
    gerados++
  }
}
console.log(`${gerados} arquivos em biblioteca/corpus`)
