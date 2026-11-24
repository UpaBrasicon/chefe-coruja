// F1 da trilha Desempenho: orçamento do JavaScript inicial (gzip).
//
//   node --experimental-strip-types scripts/orcamento-pacote.mjs dist
//   node --experimental-strip-types scripts/orcamento-pacote.mjs dist --base 300000
//   node --experimental-strip-types scripts/orcamento-pacote.mjs dist --base 300000 --falhar
//
// Soma os `.js` que o `dist/index.html` manda baixar ao abrir (script e
// modulepreload; o prefetch fica de fora), cada um em gzip padrão do zlib.
// Com --base, compara com a linha de base mais 5%: por padrão só avisa no log
// (anotação ::warning:: no GitHub); com --falhar, sai com código 1.
// Pergunta P7 ao RT: A = falhar acima de +5%, B = só avisar (o que vale hoje).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

import { avaliarOrcamento, FOLGA_PADRAO, jsIniciais } from '../src/lib/orcamentoPacote.ts'

const args = process.argv.slice(2)
const valor = (nome) => {
  const i = args.indexOf(nome)
  return i >= 0 ? args[i + 1] : undefined
}
const pasta = args.find((a, i) => !a.startsWith('--') && !['--base', '--folga'].includes(args[i - 1])) ?? 'dist'
const base = valor('--base') ? Number(valor('--base')) : undefined
const folga = valor('--folga') ? Number(valor('--folga')) : FOLGA_PADRAO
const falhar = args.includes('--falhar')

const html = readFileSync(join(pasta, 'index.html'), 'utf8')
const arquivos = jsIniciais(html)
if (arquivos.length === 0) {
  console.error(`[orcamento-pacote] nenhum .js no ${join(pasta, 'index.html')}`)
  process.exit(1)
}

let bruto = 0
let gzip = 0
const linhas = arquivos.map((f) => {
  const b = readFileSync(join(pasta, f))
  const g = gzipSync(b).length
  bruto += b.length
  gzip += g
  return { arquivo: f, bytes: b.length, gzip: g }
})
linhas.sort((a, b) => b.gzip - a.gzip)

const kb = (n) => `${(n / 1000).toFixed(1)} KB`
console.log(`JavaScript inicial: ${arquivos.length} arquivos, ${bruto} bytes, ${gzip} em gzip (${kb(gzip)})`)
for (const l of linhas) console.log(`  ${kb(l.gzip).padStart(9)}  ${l.arquivo}`)

if (base === undefined) process.exit(0)
const a = avaliarOrcamento(gzip, base, folga)
const pct = `${a.variacao >= 0 ? '+' : ''}${(a.variacao * 100).toFixed(1)}%`
if (a.passou) {
  console.log(`Dentro do orçamento: ${gzip} bytes, ${pct} sobre a base de ${base} (limite ${a.limite}).`)
  process.exit(0)
}
const msg = `JavaScript inicial acima do orçamento: ${gzip} bytes em gzip, ${pct} sobre a base de ${base} (limite ${a.limite}). Veja o que entrou no pacote de entrada ou, se foi de propósito, suba a base no ci.yml.`
if (falhar) {
  console.error(`::error::${msg}`)
  process.exit(1)
}
console.log(`::warning::${msg}`)
