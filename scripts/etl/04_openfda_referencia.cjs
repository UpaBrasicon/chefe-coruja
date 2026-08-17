const fs = require('fs')
const path = require('path')
const { nomeInternacional } = require('./sinonimos.cjs')

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 — Extração de bula (openFDA) como apoio à curadoria
// Entrada:  data/medicamento.csv (campo rxcui)
// Fonte:    openFDA Drug Label API (sem chave, rate limit ~240 req/min)
// Saída:    data/cache/openfda/<rxcui>.json (cache local, offline-first)
//           data/texto_referencia_en.csv
// Regra:    o texto EN entra como apoio de curadoria; NUNCA vira o campo
//           estruturado de diluição. Bula americana ≠ apresentação brasileira.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..')
const MED_CSV = path.join(ROOT, 'data', 'medicamento.csv')
const CACHE_DIR = path.join(ROOT, 'data', 'cache', 'openfda')
const SAIDA = path.join(ROOT, 'data', 'texto_referencia_en.csv')

function lerCsv(caminho) {
  const linhas = fs.readFileSync(caminho, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = linhas[0].split(';').map((h) => h.trim())
  return linhas.slice(1).map((l) => {
    const cols = l.split(';').map((c) => c.trim().replace(/^"(.*)"$/, '$1'))
    const obj = {}
    header.forEach((h, i) => (obj[h] = cols[i] ?? ''))
    return obj
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// extrai as seções mais úteis para curadoria de preparo/diluição
function extrairSecoes(res) {
  const doc = res.results?.[0]
  if (!doc) return null
  const pega = (campo) => (Array.isArray(doc[campo]) ? doc[campo].join('\n\n') : doc[campo] ?? '')
  return {
    set_id: doc.set_id ?? '',
    openfda: doc.openfda?.generic_name?.join(', ') ?? '',
    dosage_and_administration: pega('dosage_and_administration'),
    description: pega('description'),
    how_supplied: pega('how_supplied'),
    warnings: pega('warnings'),
  }
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const meds = lerCsv(MED_CSV)
  const linhas = []
  let ok = 0
  let semCache = 0
  let pendente = 0

  for (const m of meds) {
    const rxcui = m.rxcui
    const nome = m.principio_ativo
    const arq = path.join(CACHE_DIR, `${rxcui}.json`)

    if (!rxcui) {
      pendente++
      continue
    }

    let doc = null
    if (fs.existsSync(arq)) {
      try {
        doc = JSON.parse(fs.readFileSync(arq, 'utf8'))
        ok++
        semCache++
      } catch {
        doc = null
      }
    }

    if (!doc) {
      const generic = nomeInternacional(nome)
      const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(`"${generic}"`)}&limit=1`
      try {
        const res = await fetch(url)
        if (res.ok) {
          const j = await res.json()
          if (j.results?.length) {
            doc = extrairSecoes(j)
            fs.writeFileSync(arq, JSON.stringify(doc, null, 2))
            ok++
          } else {
            pendente++
            fs.writeFileSync(arq, JSON.stringify({ vazio: true }))
          }
        } else {
          pendente++
          fs.writeFileSync(arq, JSON.stringify({ erro: res.status }))
        }
      } catch {
        pendente++
      }
      await sleep(300) // ~200 req/min (limite é ~240)
    }

    if (doc && !doc.vazio && !doc.erro) {
      const texto = [doc.dosage_and_administration, doc.description, doc.how_supplied, doc.warnings]
        .filter(Boolean)
        .join('\n\n====\n\n')
      linhas.push({
        principio_ativo: nome,
        rxcui,
        set_id: doc.set_id ?? '',
        generic_name: doc.openfda ?? '',
        texto_referencia_en: texto,
        fonte: 'openFDA_Drug_Label',
      })
    }
  }

  const header = 'principio_ativo;rxcui;set_id;generic_name;fonte;texto_referencia_en'
  const out = [header]
  for (const l of linhas) {
    out.push(
      [l.principio_ativo, l.rxcui, l.set_id, l.generic_name, l.fonte, l.texto_referencia_en.replace(/\n/g, '\\n')].join(';')
    )
  }
  fs.writeFileSync(SAIDA, out.join('\n') + '\n', 'utf8')

  console.log(`[fase2] medicamentos com rxcui: ${meds.filter((m) => m.rxcui).length}`)
  console.log(`[fase2] bulas extraídas (cache novo ou existente): ${ok}`)
  console.log(`[fase2] sem bula no openFDA (pendente): ${pendente}`)
  console.log(`[fase2] linhas de referência gravadas: ${linhas.length}`)
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})

