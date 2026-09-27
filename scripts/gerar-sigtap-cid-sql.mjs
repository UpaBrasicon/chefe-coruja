// Gera supabase/dados/sigtap_cid.sql a partir de rl_procedimento_cid.txt da
// Tabela Unificada do SIGTAP (DATASUS). Layout (rl_procedimento_cid_layout.txt):
//   CO_PROCEDIMENTO 1-10 · CO_CID 11-14 · ST_PRINCIPAL 15 · DT_COMPETENCIA 16-21
// O CID vem sem ponto ("D093"); o banco usa o formato com ponto ("D09.3").
//   node scripts/gerar-sigtap-cid-sql.mjs data/terminologia/sigtap/rl_procedimento_cid.txt
import { readFileSync, writeFileSync } from 'node:fs'

const arquivo = process.argv[2] ?? 'data/terminologia/sigtap/rl_procedimento_cid.txt'
const linhas = readFileSync(arquivo, 'latin1').split(/\r?\n/).filter((l) => l.trim().length >= 21)
const cid = (c) => (c.length === 4 ? `${c.slice(0, 3)}.${c.slice(3)}` : c)
const pares = new Map()
const competencias = new Set()
for (const l of linhas) {
  const proc = l.slice(0, 10).trim()
  const c = cid(l.slice(10, 14).trim())
  const principal = l.slice(14, 15) === 'S'
  const comp = l.slice(15, 21)
  if (!/^\d{10}$/.test(proc) || !/^[A-Z]\d{2}(\.\d)?$/.test(c)) throw new Error(`linha inválida: ${l}`)
  competencias.add(comp)
  pares.set(`${proc}|${c}`, [proc, c, principal])
}
if (competencias.size !== 1) throw new Error(`mais de uma competência: ${[...competencias]}`)
const [competencia] = competencias
const valores = [...pares.values()]
const blocos = []
for (let i = 0; i < valores.length; i += 5000) {
  const v = valores.slice(i, i + 5000).map(([p, c, s]) => `('${p}','${c}',${s})`).join(',\n')
  blocos.push(`INSERT INTO terminologia.sigtap_procedimento_cid (procedimento, cid, principal, competencia)
SELECT v.p, v.c, v.s, '${competencia}' FROM (VALUES
${v}
) AS v(p, c, s)
ON CONFLICT (procedimento, cid) DO UPDATE SET principal = EXCLUDED.principal, competencia = EXCLUDED.competencia;`)
}
const sql = `-- GERADO por scripts/gerar-sigtap-cid-sql.mjs — não editar à mão.
-- Compatibilidade procedimento × CID do SIGTAP (DATASUS, Tabela Unificada),
-- competência ${competencia}: ${valores.length} pares. Fonte: rl_procedimento_cid.txt.
BEGIN;
DELETE FROM terminologia.sigtap_procedimento_cid WHERE competencia <> '${competencia}';
${blocos.join('\n')}
COMMIT;
`
writeFileSync('supabase/dados/sigtap_cid.sql', sql)
console.log(`supabase/dados/sigtap_cid.sql: ${valores.length} pares, competência ${competencia}`)
