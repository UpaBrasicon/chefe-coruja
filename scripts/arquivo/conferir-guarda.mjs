// Confere uma guarda gerada por exportar-guarda.mjs: recalcula o sha256 de
// cada arquivo do MANIFESTO.json. Rodar ao gravar a cópia no destino e, depois,
// periodicamente (ex.: a cada 6 meses) para provar que a cópia continua íntegra.
// Uso: node scripts/arquivo/conferir-guarda.mjs <pasta-da-guarda>
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const pasta = process.argv[2]
if (!pasta || !existsSync(join(pasta, 'MANIFESTO.json'))) {
  console.error('uso: node scripts/arquivo/conferir-guarda.mjs <pasta-da-guarda>')
  process.exit(1)
}
const m = JSON.parse(readFileSync(join(pasta, 'MANIFESTO.json'), 'utf8'))
let falhas = 0
for (const a of m.arquivos) {
  const c = join(pasta, ...a.arquivo.split('/'))
  if (!existsSync(c)) { falhas++; console.log(`✖ falta ${a.arquivo}`); continue }
  const h = createHash('sha256').update(readFileSync(c)).digest('hex')
  if (h !== a.sha256) { falhas++; console.log(`✖ alterado ${a.arquivo}`) }
}
console.log(falhas ? `${falhas} problema(s) em ${m.arquivos.length} arquivo(s)` : `✔ ${m.arquivos.length} arquivo(s) íntegros · gerada em ${m.gerado_em}`)
process.exit(falhas ? 1 : 0)
