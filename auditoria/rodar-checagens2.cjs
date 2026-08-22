// Checagens complementares para as migrations (somente leitura).
// Uso: node auditoria/rodar-checagens2.cjs <token> [ref]
const fs = require('fs')
const path = require('path')

const token = process.argv[2]
const ref = process.argv[3] || 'saqjrjtrkzkswsxxvdxn'
if (!token) { console.error('uso: node rodar-checagens2.cjs <token> [ref]'); process.exit(1) }

const CHECAGENS = {
  perfil_colunas_auth: `select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='perfis' and (column_name like '%user%' or column_name='id') order by column_name;`,
  private_funcoes_todas: `select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.provolatile, p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' order by p.proname;`,
  realtime_messages_pub: `select schemaname, tablename from pg_publication_tables where pubname='supabase_realtime_messages_publication' order by 1,2;`,
  grants_atuais_anon: `select distinct privilege_type from information_schema.role_table_grants where table_schema='public' and grantee='anon' order by 1;`,
  grants_atuais_authenticated: `select distinct privilege_type from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' order by 1;`,
  uso_escala_plantao: `select 'escala_plantao' as tabela, count(*) as qtd from public.escala_plantao union all select 'escala_plantoes', count(*) from public.escala_plantoes union all select 'medicamento', count(*) from public.medicamento union all select 'medicamentos', count(*) from public.medicamentos;`,
}

async function rodar(nome, sql) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const texto = await resp.text()
  let json
  try { json = JSON.parse(texto) } catch { json = { erro_parse: texto.slice(0, 400) } }
  return { nome, status: resp.status, json }
}

;(async () => {
  const out = {}
  for (const [nome, sql] of Object.entries(CHECAGENS)) {
    const r = await rodar(nome, sql)
    out[nome] = r.json
    const dados = Array.isArray(r.json) ? r.json : []
    console.log(`${r.status === 200 || r.status === 201 ? '✅' : '❌'} ${nome} — ${dados.length} linha(s)`)
  }
  fs.writeFileSync(path.join(__dirname, 'checagens2.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log('\nSalvo em auditoria/checagens2.json')
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
