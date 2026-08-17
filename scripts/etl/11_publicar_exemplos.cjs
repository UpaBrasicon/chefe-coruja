const { Client } = require('pg')

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    // Publica diluições de exemplo (simulando revisão do farmacêutico) para
    // demonstrar a integração na UI. Identifica pelo medicamento/princípio.
    const alvos = [
      ['ceftriaxona', '1 g', 'Ceftriaxona (revisada)'],
      ['omeprazol', '40 mg', 'Omeprazol (revisada)'],
      ['vancomicina', '500 mg', 'Vancomicina (revisada)'],
    ]
    for (const [pa, ap, revisor] of alvos) {
      const m = await client.query(
        `SELECT id FROM public.medicamento WHERE principio_ativo ILIKE $1 ORDER BY length(principio_ativo_norm) LIMIT 1`,
        [`%${pa}%`]
      )
      if (!m.rows[0]) {
        console.log(`  - ${pa}: medicamento não encontrado`)
        continue
      }
      const r = await client.query(
        `UPDATE public.diluicao
           SET status = 'publicado', revisor_crf = $1, data_revisao = CURRENT_DATE
           WHERE medicamento_id = $2 AND status = 'rascunho'
           RETURNING id, principio_ativo, via`,
        [revisor, m.rows[0].id]
      )
      console.log(`  - ${pa} (${ap}): ${r.rowCount} publicação(ões)`)
      for (const row of r.rows) {
        console.log(`      ${row.principio_ativo} · via ${row.via}`)
      }
    }
    const c = await client.query(`SELECT count(*) AS n FROM public.diluicao WHERE status = 'publicado'`)
    console.log(`Total publicadas: ${c.rows[0].n}`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
