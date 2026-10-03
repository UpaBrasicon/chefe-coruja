// Abre uma guarda baixada do cofre (os .ccg de uma pasta guarda-AAAA-MM-DD-HHMM
// mais o indice.ccg) e reconstrói os arquivos originais, conferindo o sha256.
//
// No Deep Archive, antes de baixar é preciso pedir a restauração no console do
// S3 (Ações → Iniciar restauração; leva de 12 a 48 horas).
//
// Uso: node scripts/arquivo/abrir-guarda.mjs <pasta-com-os-ccg> --destino <pasta>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { decifrar, derivarChave, perguntarSenha, salDe, sha256 } from './cofre.mjs'

const args = process.argv.slice(2)
const origem = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null
const i = args.indexOf('--destino')
const destino = i >= 0 ? resolve(args[i + 1]) : null
if (!origem || !destino || !existsSync(join(origem, 'indice.ccg'))) {
  console.error('uso: node scripts/arquivo/abrir-guarda.mjs <pasta-com-os-ccg> --destino <pasta>')
  process.exit(1)
}

const ccgIndice = readFileSync(join(origem, 'indice.ccg'))
const senha = await perguntarSenha('Senha da guarda: ')
const chave = derivarChave(senha, salDe(ccgIndice))
const indice = JSON.parse(decifrar(chave, ccgIndice).toString('utf8'))

let falhas = 0
for (const o of indice.objetos) {
  const nome = o.objeto.split('/').pop()
  const c = join(origem, nome)
  if (!existsSync(c)) { falhas++; console.log(`✖ falta ${nome} (${o.arquivo})`); continue }
  const claro = decifrar(chave, readFileSync(c))
  if (sha256(claro).toString('hex') !== o.sha256_claro) { falhas++; console.log(`✖ alterado ${o.arquivo}`); continue }
  const alvo = join(destino, ...o.arquivo.split('/'))
  mkdirSync(dirname(alvo), { recursive: true })
  writeFileSync(alvo, claro)
}
console.log(falhas
  ? `${falhas} problema(s) em ${indice.objetos.length} arquivo(s)`
  : `✔ ${indice.objetos.length} arquivo(s) abertos em ${destino} · guarda gerada em ${indice.manifesto.gerado_em}`)
process.exit(falhas ? 1 : 0)
