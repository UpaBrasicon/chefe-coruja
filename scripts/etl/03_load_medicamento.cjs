const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 — Load da tabela canônica `medicamento` a partir do medicamento.csv
// via pooler (DATABASE_URL). Idempotente: ON CONFLICT (norm, apresentacao) DO UPDATE.
// Alta vigilância marcada a partir de alta_vigilancia_ismp.csv.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..')
const MED_CSV = path.join(ROOT, 'data', 'medicamento.csv')
const ISMP_CSV = path.join(ROOT, 'data', 'alta_vigilancia_ismp.csv')

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

  const meds = lerCsv(MED_CSV)
  const ismp = new Set(lerCsv(ISMP_CSV).map((i) => normalizar(i.principio_ativo)))

  const valores = meds
    .map((m) => {
      const pa_norm = m.principio_ativo_norm || normalizar(m.principio_ativo)
      const altaVig = ismp.has(normalizar(m.principio_ativo)) ? 'true' : 'false'
      return `(${esc(m.principio_ativo)}, ${esc(pa_norm)}, ${esc(m.apresentacao)}, ${esc(m.concentracao)}, ${esc(m.setor_uso)}, ${esc(m.rxcui)}, ${esc(m.anvisa_registro)}, ${esc(m.anvisa_produto)}, ${esc(m.anvisa_situacao)}, ${esc(m.anvisa_empresa)}, ${altaVig})`
    })
    .join(',\n')

  const SQL = `
    INSERT INTO public.medicamento
      (principio_ativo, principio_ativo_norm, apresentacao, concentracao, setor_uso,
       rxcui, anvisa_registro, anvisa_produto, anvisa_situacao, anvisa_empresa, alta_vigilancia)
    VALUES
      ${valores}
    ON CONFLICT (principio_ativo_norm, apresentacao) DO UPDATE SET
      principio_ativo = EXCLUDED.principio_ativo,
      apresentacao = EXCLUDED.apresentacao,
      concentracao = EXCLUDED.concentracao,
      setor_uso = EXCLUDED.setor_uso,
      rxcui = EXCLUDED.rxcui,
      anvisa_registro = EXCLUDED.anvisa_registro,
      anvisa_produto = EXCLUDED.anvisa_produto,
      anvisa_situacao = EXCLUDED.anvisa_situacao,
      anvisa_empresa = EXCLUDED.anvisa_empresa,
      alta_vigilancia = EXCLUDED.alta_vigilancia,
      fonte = 'ETL_FASE1'
  `

  try {
    await client.query('BEGIN')
    const res = await client.query(SQL)
    await client.query('COMMIT')
    const count = await client.query('SELECT count(*) AS n FROM public.medicamento')
    console.log(`[load] ${res.rowCount} linhas afetadas`)
    console.log(`[load] total na tabela medicamento: ${count.rows[0].n}`)
    console.log(`[load] alta vigilância: ${ismp.size} itens da lista`)
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
