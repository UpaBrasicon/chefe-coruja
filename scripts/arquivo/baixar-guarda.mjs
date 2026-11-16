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
// Desde o S10 (H2) baixa a versão MAIS ANTIGA de cada objeto: a chave precisa
// de s3:ListBucketVersions e s3:GetObjectVersion (além de s3:GetObject).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { caminhoConfinado } from './caminho.mjs'
import { baixar, consultar, credenciais, listarVersoes, sha256, versaoMaisAntiga } from './cofre.mjs'

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
let pasta
try { pasta = caminhoConfinado(destino, prefixo) } catch (e) { console.error(`prefixo ${e.message}`); process.exit(1) }
if (existsSync(pasta)) { console.error(`${pasta} já existe: escolha outro destino`); process.exit(1) }
mkdirSync(pasta, { recursive: true })

// S10, H2: o cofre guarda versões; quem tem a chave de envio poderia subir uma
// versão nova de um objeto. Baixa sempre a versão MAIS ANTIGA (a original),
// avisa se houver mais de uma, e exige o checksum dessa versão.
let avisos = 0
async function pegar(nome) {
  const chaveObjeto = `${prefixo}/${nome}`
  const lista = await listarVersoes({ bucket, regiao, chaveObjeto, cred })
  const original = versaoMaisAntiga(lista)
  if (!original) return false
  const versoes = lista.length
  if (versoes > 1) {
    avisos++
    console.log(`\n  ⚠⚠ ATENÇÃO: ${nome} tem ${versoes} versões no cofre; usando a original de ${original.data}.\n     Uma versão a mais pode ser adulteração: avise o RT antes de usar esta guarda.\n`)
  }
  const meta = await consultar({ bucket, regiao, chaveObjeto, versao: original.versao, cred })
  if (!meta.checksum) throw new Error(`${nome}: o cofre não devolveu o checksum; sem ele não há como conferir o download`)
  const corpo = await baixar({ bucket, regiao, chaveObjeto, versao: original.versao, cred })
  if (sha256(corpo).toString('base64') !== meta.checksum) throw new Error(`${nome}: conteúdo diferente do checksum do cofre`)
  writeFileSync(join(pasta, nome), corpo)
  return true
}

if (!(await pegar('indice.ccg'))) {
  console.error(`✖ ${prefixo}/indice.ccg não encontrado no cofre (prefixo errado, ou guarda no Deep Archive sem restauração pedida)`)
  process.exit(1)
}
let n = 0
while (await pegar(`${String(n + 1).padStart(5, '0')}.ccg`)) n++
console.log(`✔ ${n} objeto(s) + indice.ccg baixados em ${pasta} (versão original, checksum conferido)`)
if (avisos) console.log(`⚠ ${avisos} objeto(s) com mais de uma versão no cofre: veja os avisos acima antes de usar esta guarda.`)
console.log(`  abrir: node scripts/arquivo/abrir-guarda.mjs "${pasta}" --destino <pasta> --chave-privada <guarda-privada.pem>`)
