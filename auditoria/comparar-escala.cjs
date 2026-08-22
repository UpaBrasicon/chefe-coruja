// Compara uso real: escala_plantao vs escala_plantoes no código + dados.
const fs = require('fs')
const path = require('path')
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
  // 1. contagem + amostra das duas
  console.log('=== 1. contagem ===')
  console.log(JSON.stringify(await q(`select 'escala_plantao' t, count(*) from public.escala_plantao union all select 'escala_plantoes', count(*) from public.escala_plantoes;`), null, 2))

  // 2. os IDs se sobrepõem? (mesmos registros?)
  console.log('=== 2. sobreposição de ids ===')
  console.log(JSON.stringify(await q(`select count(*) as em_ambas from public.escala_plantao a join public.escala_plantoes b on b.id = a.id;`), null, 2))

  // 3. dados de escala_plantoes (amostra)
  console.log('=== 3. amostra escala_plantoes (15 linhas) ===')
  console.log(JSON.stringify(await q(`select id, unidade_id, perfil_id, setor_id, data, turno, ativo from public.escala_plantoes order by data desc limit 6;`), null, 2))

  // 4. os dados de escala_plantoes existem também em escala_plantao?
  console.log('=== 4. escala_plantoes tem registros únicos (não em escala_plantao)? ===')
  console.log(JSON.stringify(await q(`select count(*) as unicos_plural from public.escala_plantoes b where not exists (select 1 from public.escala_plantao a where a.id = b.id);`), null, 2))

  // 5. RLS das duas
  console.log('=== 5. RLS e policies ===')
  console.log(JSON.stringify(await q(`select c.relname as tabela, c.relrowsecurity, p.policyname, p.cmd from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname where n.nspname='public' and c.relname in ('escala_plantao','escala_plantoes') order by 1,4;`), null, 2))
})().catch((e) => { console.error('falha:', e.message); process.exit(1) })
