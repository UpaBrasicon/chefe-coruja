const fs = require('fs')
const path = require('path')

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 — ETL de identificação canônica de medicamentos
// Fontes: ANVISA Dados Abertos (cache local) + RxNorm/RxNav (rxcui).
// Estratégia offline-first: baixa a fonte uma vez, grava checksum e, se a
// rede cair, usa o cache. Nunca depende de internet em runtime da plataforma.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..')
const DATA = path.join(ROOT, 'data')
const CACHE = path.join(DATA, 'cache')
const ANVISA_URL = 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv'
const ANVISA_FILE = path.join(CACHE, 'anvisa_medicamentos.csv')
const ANVISA_MD5 = path.join(CACHE, 'anvisa_medicamentos.md5')

function sha1(buf) {
  const crypto = require('crypto')
  return crypto.createHash('sha1').update(buf).digest('hex')
}

async function baixar(url, destino) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} para ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.writeFileSync(destino, buf)
  fs.writeFileSync(destino + '.md5', sha1(buf))
  console.log(`[download] ${url} -> ${path.basename(destino)} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
  return buf
}

async function garantirAnvisa() {
  const existe = fs.existsSync(ANVISA_FILE) && fs.existsSync(ANVISA_MD5)
  if (existe) {
    const buf = fs.readFileSync(ANVISA_FILE)
    const md5 = fs.readFileSync(ANVISA_MD5, 'utf8').trim()
    if (sha1(buf) === md5) {
      console.log('[cache] ANVISA já em cache, checksum OK (modo offline)')
      return
    }
    console.log('[cache] checksum mudou — baixando novamente')
  }
  await baixar(ANVISA_URL, ANVISA_FILE)
}

async function main() {
  fs.mkdirSync(CACHE, { recursive: true })
  await garantirAnvisa()
  console.log('OK')
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
