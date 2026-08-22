// Investiga quem chama pg_timezone_names (119 chamadas / 640ms média).
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
  console.log('=== 1. detalhes das chamadas a pg_timezone_names (pg_stat_statements) ===')
  console.log(JSON.stringify(await q(`
    select calls, round(total_exec_time::numeric) as total_ms,
           round(mean_exec_time::numeric,1) as media_ms,
           round(min_exec_time::numeric,1) as min_ms,
           round(max_exec_time::numeric,1) as max_ms,
           left(regexp_replace(query,'\\s+',' ','g'),120) as query
    from pg_stat_statements
    where query ilike '%pg_timezone_names%'
    order by total_exec_time desc limit 5;`), null, 2))

  console.log('=== 2. pg_timezone_names tem índice? (é view do catálogo) ===')
  console.log(JSON.stringify(await q(`
    select n.nspname, c.relname, c.relkind
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relname='pg_timezone_names';`), null, 2))

  console.log('=== 3. bibliotecas no frontend que listam timezones ===')
  const fs = require('fs')
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  for (const [nome, ver] of Object.entries(deps)) {
    if (/date|time|tz|moment|dayjs|zoned/i.test(nome)) console.log(' ', nome, ver)
  }
  console.log('--- fim deps de data/tz ---')

  console.log('=== 4. grep no código por timezone/tz/Intl ===')
  const { execSync } = require('child_process')
  const out = execSync('node -e "const fs=require(\\'fs\\');const alvos=[];function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=d+\'/\'+e.name;if(e.isDirectory())walk(f);else if(/\\.(ts|tsx)$/.test(e.name)){const c=fs.readFileSync(f,\'utf8\');if(/timeZone|timezone|time_zone|Intl\\.DateTimeFormat|moment\\.tz/.test(c))alvos.push(f)}}}walk(\\'src\\');for(const f of alvos){const c=fs.readFileSync(f,\'utf8\');const ls=c.split(\\'\\n\\');ls.forEach((l,i)=>{if(/timeZone|timezone|time_zone|Intl\\.DateTimeFormat|moment\\.tz/.test(l))console.log(f+\':\'+(i+1)+\':\'+l.trim().slice(0,100))})}"', { encoding: 'utf8' })
  console.log(out.split('\n').filter(Boolean).slice(0, 20).join('\n') || '  (nenhum uso direto)')
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
