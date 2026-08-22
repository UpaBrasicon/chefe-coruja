// Verifica se os nomes de índice a criar já existem com definição diferente.
// Uso: node auditoria/verificar-nomes-idx.cjs <token> [ref]
const fs = require('fs')
const path = require('path')

const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso'); process.exit(1) }

// junta os DDLs dos dois geradores
const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'checagens.json'), 'utf8'))
const ddls = [
  ...c.C1_gerador_tenant.map((l) => l.ddl),
  ...c.C1_gerador_fk.map((l) => l.ddl),
]

// extrai (nome, tabela, coluna)
const alvos = []
for (const d of ddls) {
  const m = d.match(/create index if not exists ([a-z0-9_]+) on public\.([a-z_]+) \(([a-z_]+)\)/)
  if (m) alvos.push({ nome: m[1], tabela: m[2], coluna: m[3] })
}

const sql = `
select i.relname as index_name, t.relname as tabela,
       pg_get_indexdef(x.indexrelid) as definicao
from pg_index x
join pg_class i on i.oid = x.indexrelid
join pg_class t on t.oid = x.indrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and i.relname in (${alvos.map(() => "'?'").join(',')});
`.replace(/\?/g, 'DUMMY') // substitui depois

// constrói a query com os nomes de verdade
const nomes = alvos.map((a) => `'${a.nome}'`).join(',')
const query = `
select i.relname as index_name, t.relname as tabela,
       pg_get_indexdef(x.indexrelid) as definicao
from pg_index x
join pg_class i on i.oid = x.indexrelid
join pg_class t on t.oid = x.indrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and i.relname in (${nomes})
order by i.relname;`

;(async () => {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const texto = await resp.text()
  let json
  try { json = JSON.parse(texto) } catch { json = { erro: texto.slice(0, 400) } }
  const dados = Array.isArray(json) ? json : []
  console.log(`índices já existentes com esses nomes: ${dados.length}`)
  for (const l of dados) console.log(' ', l.index_name, '|', l.tabela, '|', String(l.definicao).slice(0, 110))
  fs.writeFileSync(path.join(__dirname, 'idx-existentes.json'), JSON.stringify(dados, null, 2), 'utf8')
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
