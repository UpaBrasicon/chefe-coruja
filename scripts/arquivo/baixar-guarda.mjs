// Baixa uma guarda do cofre S3 (os .ccg numerados e o indice.ccg) para uma
// pasta, conferindo o sha256 de cada objeto com o checksum guardado no S3.
// Depois: node scripts/arquivo/abrir-guarda.mjs <pasta> --destino <pasta> [--chave-privada <pem>]
//
// Guardas com mais de 30 dias estão no Glacier Deep Archive: antes, peça a
// restauração no console do S3 (Ações → Iniciar restauração; 12 a 48 horas).
//
// Uso:
//   node scripts/arquivo/baixar-guarda.mjs <prefixo, ex.: auto-20261006-2314> --destino <pasta> --credenciais <chave.csv>
// A chave .csv é a do usuário IAM guarda-envio (lê e grava só neste bucket).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { baixar, consultar, credenciais, sha256 } from './cofre.mjs'

const args = process.argv.slice(2)
const opt = (n, padrao) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : padrao }
const prefixo = args[0] && !args[0].startsWith('--') ? args[0].replace(/\/$/, '') : null
const destino = opt('--destino') ? resolve(opt('--destino')) : null
const bucket = opt('--bucket', 'chefe-coruja-guarda-saqjrjt')
const regiao = opt('--regiao', 'sa-east-1')
if (!prefixo || !destino) {
  console.error('uso: node scripts/arquivo/baixar-guarda.mjs <prefixo> --destino <pasta> --credenciais <chave.csv>')
  process.exit(1)
}
const cred = credenciais(opt('--credenciais'))
const pasta = join(destino, prefixo)
if (existsSync(pasta)) { console.error(`${pasta} já existe: escolha outro destino`); process.exit(1) }
mkdirSync(pasta, { recursive: true })

async function pegar(nome) {
  const chaveObjeto = `${prefixo}/${nome}`
  let meta
  try { meta = await consultar({ bucket, regiao, chaveObjeto, cred }) } catch { return false }
  const corpo = await baixar({ bucket, regiao, chaveObjeto, cred })
  if (meta.checksum && sha256(corpo).toString('base64') !== meta.checksum) throw new Error(`${nome}: conteúdo diferente do checksum do cofre`)
  writeFileSync(join(pasta, nome), corpo)
  return true
}

if (!(await pegar('indice.ccg'))) {
  console.error(`✖ ${prefixo}/indice.ccg não encontrado no cofre (prefixo errado, ou guarda no Deep Archive sem restauração pedida)`)
  process.exit(1)
}
let n = 0
while (await pegar(`${String(n + 1).padStart(5, '0')}.ccg`)) n++
console.log(`✔ ${n} objeto(s) + indice.ccg baixados em ${pasta} (checksum conferido)`)
console.log(`  abrir: node scripts/arquivo/abrir-guarda.mjs "${pasta}" --destino <pasta> --chave-privada <guarda-privada.pem>`)
