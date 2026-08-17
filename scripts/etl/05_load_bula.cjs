const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 — Load de bulas de referência (openFDA) na tabela medicamento_bula
// via pooler. Idempotente: upsert por medicamento (UNIQUE medicamento_id).
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..')
const CSV = path.join(ROOT, 'data', 'texto_referencia_en.csv')

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

function esc(v) {
  if (v == null || v === '') return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const linhas = lerCsv(CSV)
  let total = 0

  for (const l of linhas) {
    // resolve medicamento_id pelo principio_ativo_norm
    const norm = l.principio_ativo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const res = await client.query(
      `SELECT id FROM public.medicamento WHERE principio_ativo = $1 LIMIT 1`,
      [l.principio_ativo]
    )
    const mid = res.rows[0]?.id
    if (!mid) continue

    await client.query(
      `INSERT INTO public.medicamento_bula
         (medicamento_id, principio_ativo, rxcui, set_id, generic_name, fonte, texto_referencia_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (medicamento_id) DO UPDATE SET
         rxcui = EXCLUDED.rxcui,
         set_id = EXCLUDED.set_id,
         generic_name = EXCLUDED.generic_name,
         texto_referencia_en = EXCLUDED.texto_referencia_en`,
      [mid, l.principio_ativo, l.rxcui || null, l.set_id || null, l.generic_name || null, l.fonte || 'openFDA_Drug_Label', l.texto_referencia_en || null]
    )
    total++
  }

  const count = await client.query('SELECT count(*) AS n FROM public.medicamento_bula')
  console.log(`[load] bulas inseridas/atualizadas: ${total}`)
  console.log(`[load] total em medicamento_bula: ${count.rows[0].n}`)
  await client.end()
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
