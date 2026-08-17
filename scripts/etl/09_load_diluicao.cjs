const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3 — Load de diluições (rascunho) na tabela public.diluicao
// via pooler. Vincula por principio_ativo ao medicamento canônico.
// Nada é publicado sem revisor_crf (regra inegociável).
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..')
const CSV = path.join(ROOT, 'data', 'diluicao.csv')

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

function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const dil = lerCsv(CSV)
  let inseridas = 0
  let semMed = 0

  for (const d of dil) {
    const pa = d.principio_ativo
    // busca medicamento pelo primeiro token do princípio (mais robusto)
    const primeiro = normalizar(pa).split(' ')[0]
    const res = await client.query(
      `SELECT id FROM public.medicamento
       WHERE principio_ativo_norm LIKE $1
       ORDER BY length(principio_ativo_norm) LIMIT 1`,
      [`${primeiro}%`]
    )
    const mid = res.rows[0]?.id
    if (!mid) {
      semMed++
      continue
    }

    const solucao = d.diluicao_solucao ? d.diluicao_solucao.split(',').filter(Boolean) : null
    const tempoRaw = d.tempo_infusao_min ? String(d.tempo_infusao_min).match(/(\d+)/) : null
    const tempoMin = tempoRaw ? parseInt(tempoRaw[1], 10) : null

    const volRaw = d.diluicao_volume_min_ml ? String(d.diluicao_volume_min_ml).match(/(\d+)/) : null
    const volMin = volRaw ? parseInt(volRaw[1], 10) : null

    await client.query(
      `INSERT INTO public.diluicao
        (medicamento_id, principio_ativo, apresentacao, via,
         diluicao_solucao, diluicao_volume_min_ml, tempo_infusao_min,
         ajuste_renal, observacoes, fonte, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'rascunho')
       ON CONFLICT DO NOTHING`,
      [
        mid,
        d.principio_ativo,
        d.apresentacao || null,
        d.via || null,
        solucao,
        volMin,
        tempoMin,
        d.ajuste_renal === 'true' ? true : d.ajuste_renal === 'false' ? false : null,
        d.observacoes || null,
        d.fonte || 'HU-UFGD_v3',
      ]
    )
    inseridas++
  }

  const count = await client.query('SELECT count(*) AS n FROM public.diluicao')
  console.log(`[load] diluições processadas: ${dil.length}`)
  console.log(`[load] inseridas (com medicamento): ${inseridas}`)
  console.log(`[load] sem medicamento correspondente: ${semMed}`)
  console.log(`[load] total em diluicao: ${count.rows[0].n}`)
  await client.end()
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
