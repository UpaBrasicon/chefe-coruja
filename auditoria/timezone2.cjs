// Confirma o padrão temporal das chamadas a pg_timezone_names.
const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso'); process.exit(1) }

async function q(sql) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const texto = await resp.text()
  try { return JSON.parse(texto) } catch { return { raw: texto.slice(0, 300) } }
}

;(async () => {
  console.log('=== 1. pg_timezone_names: detalhe completo ===')
  console.log(JSON.stringify(await q(`
    select calls, round(total_exec_time::numeric) as total_ms,
           round(mean_exec_time::numeric,1) as media_ms,
           round(min_exec_time::numeric,1) as min_ms,
           round(max_exec_time::numeric,1) as max_ms,
           round(stddev_exec_time::numeric,1) as desvio,
           left(query, 80) as query
    from pg_stat_statements
    where query ilike '%pg_timezone_names%';`), null, 2))

  console.log('=== 2. janela temporal (últimas execuções via pg_stat_statements reset? — mostra quando começou) ===')
  console.log(JSON.stringify(await q(`select stats_reset from pg_stat_statements_info;`), null, 2))

  console.log('=== 3. conexões ativas e seus aplicativos agora ===')
  console.log(JSON.stringify(await q(`
    select usename, application_name, client_addr::text, state, count(*) as n
    from pg_stat_activity where datname = current_database()
    group by 1,2,3,4 order by n desc;`), null, 2))

  console.log('=== 4. pg_timezone_names custo (é view de catálogo — o custo é do scan) ===')
  console.log(JSON.stringify(await q(`
    explain (format json) select * from pg_timezone_names;`), null, 2))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
