const fs = require('fs')
const path = require('path')

// ─────────────────────────────────────────────────────────────────────────────
// FASE 4 — Interações medicamentosas OFFLINE.
//
// Estratégia em camadas (ordem de preferência):
//   1. RxNav-in-a-Box LOCAL em http://localhost:4000 (Docker) — offline total.
//   2. Cache REST local (data/cache/rxnav/interactions/<rxcui>.json) — reuso offline.
//   3. RxNorm REST remoto (rxnav.nlm.nih.gov) — usado apenas para PRÉ-CARREGAR o
//      cache quando há internet; em runtime da UPA, só camada 1 ou 2.
//
// RxNav-in-a-Box exige licença UMLS no download e Docker Desktop (12GB RAM,
// 100GB disco). Até isso ser provisionado, este script usa as camadas 2 e 3.
//
// A API de interação do RxNav é /REST/interaction/interaction.json?rxcui=...
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..')
const CACHE = path.join(ROOT, 'data', 'cache', 'rxnav', 'interactions')
const RXNAV_LOCAL = 'http://localhost:4000/RxNav'
const RXNAV_REMOTO = 'https://rxnav.nlm.nih.gov/REST'

const RXNAV_IN_A_BOX_URL = 'https://download.nlm.nih.gov/umls/kss/rxnav/rxnav-in-a-box/rxnav-in-a-box-20260803.zip'
const README_URL = 'https://data.lhncbc.nlm.nih.gov/public/rxnav/rxnav-in-a-box/README.txt'

function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function temRxNavLocal() {
  try {
    const res = await fetch(`${RXNAV_LOCAL}/interaction/interaction.json?rxcui=7052`, {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}

async function interagir(rxcui, usarLocal) {
  const arq = path.join(CACHE, `${rxcui}.json`)
  if (fs.existsSync(arq)) {
    try {
      const c = JSON.parse(fs.readFileSync(arq, 'utf8'))
      return { origem: 'cache', data: c }
    } catch {
      /* recarrega */
    }
  }
  const base = usarLocal ? RXNAV_LOCAL : RXNAV_REMOTO
  const url = `${base}/interaction/interaction.json?rxcui=${rxcui}`
  try {
    const res = await fetch(url)
    if (!res.ok) return { origem: 'erro', data: { status: res.status } }
    const j = await res.json()
    const interacoes = j.interactionTypeGroup?.[0]?.interactionType ?? []
    fs.mkdirSync(CACHE, { recursive: true })
    fs.writeFileSync(arq, JSON.stringify(j, null, 2))
    return { origem: usarLocal ? 'rxnav_local' : 'rxnav_remoto', data: j }
  } catch {
    return { origem: 'erro', data: { mensagem: 'sem rede e sem cache local' } }
  }
}

async function main() {
  const rxcuis = process.argv.slice(2)
  if (rxcuis.length === 0) {
    console.log(
      'Uso: node 10_interacoes_rxnav.cjs <rxcui> [<rxcui> ...]\n' +
        'Ex.: node 10_interacoes_rxnav.cjs 7052 3523'
    )
    console.log('\nRxNav-in-a-Box:')
    console.log(`  Download (exige licença UMLS): ${RXNAV_IN_A_BOX_URL}`)
    console.log(`  README: ${README_URL}`)
    console.log('  Requisitos: Docker Desktop, 12GB RAM, 100GB disco, porta 4000')
    return
  }

  const local = await temRxNavLocal()
  console.log(`[fase4] RxNav local detectado: ${local ? 'SIM (localhost:4000)' : 'NÃO (usando cache/remoto)'}`)

  for (const rc of rxcuis) {
    const r = await interagir(rc, local)
    if (r.origem === 'erro') {
      console.log(`\nrxcui ${rc}: SEM DADOS (${r.data.mensagem ?? r.data.status})`)
      continue
    }
    const tipo = r.data.interactionTypeGroup?.[0]?.interactionType ?? []
    const n = tipo.reduce((acc, t) => acc + (t.interactionPair?.length ?? 0), 0)
    console.log(`\nrxcui ${rc}: ${n} interação(ões) [fonte: ${r.origem}]`)
    for (const t of tipo) {
      for (const p of t.interactionPair ?? []) {
        const desc = p.description ?? ''
        console.log(`  - ${p.interactionConcept?.[0]?.minConcept?.name ?? ''} × ${p.interactionConcept?.[1]?.minConcept?.name ?? ''}: ${desc.slice(0, 120)}`)
      }
    }
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
