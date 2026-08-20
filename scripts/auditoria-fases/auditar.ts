// Auditoria de segurança das migrations (FASE 4A e geral)
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'supabase/migrations'
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const created = new Map<string, string>()
const rls = new Set<string>()
for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf8')
  let m: RegExpExecArray | null
  const re = /CREATE TABLE (?:IF NOT EXISTS )?(?:(?:public|terminologia)\.)?([a-z_0-9]+)/g
  while ((m = re.exec(sql))) if (!created.has(m[1])) created.set(m[1], f)
  const re2 = /ALTER TABLE (?:(?:public|terminologia)\.)?([a-z_0-9]+)\s+ENABLE ROW LEVEL SECURITY/g
  while ((m = re2.exec(sql))) rls.add(m[1])
}
console.log('TABELAS SEM RLS:')
let achou = false
for (const [t, f] of created) if (!rls.has(t)) { console.log('  -', t, '(' + f + ')'); achou = true }
if (!achou) console.log('  (nenhuma)')
console.log('Total:', created.size, 'tabelas |', rls.size, 'com RLS')

// políticas com USING(true)/WITH CHECK(true) — mostra tabela + papel
console.log('\nPOLÍTICAS COM true (qualificação de papel):')
const rePol = /CREATE POLICY "([^"]+)" ON (?:public\.)?([a-z_0-9]+)[\s\S]*?FOR (SELECT|ALL|INSERT|UPDATE|DELETE)[\s\S]*?TO ([a-z_]+)[\s\S]*?((?:USING|WITH CHECK) \(\s*true\s*\))/g
let achou2 = false
for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf8')
  let m: RegExpExecArray | null
  while ((m = rePol.exec(sql))) {
    console.log('  -', m[1], '| tabela', m[2], '| FOR', m[3], '| TO', m[4], '|', m[5])
    achou2 = true
  }
}
if (!achou2) console.log('  (nenhuma)')

// SECURITY DEFINER sem SET search_path (verificação de todas as funções)
console.log('\nSECURITY DEFINER SEM search_path:')
let semSearch = 0
for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf8')
  const bloco = sql.split(/CREATE OR REPLACE FUNCTION/i)
  for (let i = 1; i < bloco.length; i++) {
    const nome = (bloco[i].match(/^\s*(public|private)\.[a-z_0-9]+/i) ?? [])[0]
    if (!nome) continue
    if (/SECURITY DEFINER/i.test(bloco[i]) && !/SET search_path/i.test(bloco[i])) {
      console.log('  -', nome.trim(), '(' + f.slice(0, 20) + ')')
      semSearch++
    }
  }
}
if (semSearch === 0) console.log('  (nenhuma — todas com search_path fixo)')

// migrations destrutivas sem bloco DOWN
console.log('\nMIGRATIONS DESTRUTIVAS SEM DOWN DOCUMENTADO:')
for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf8')
  const destrutivo = /\bDROP\s+TABLE\b|\bDROP\s+SCHEMA\b|\bDROP\s+COLUMN\b/i.test(sql)
  const temDown = /DOWN/i.test(sql)
  if (destrutivo && !temDown) console.log('  -', f, '(DROP sem bloco DOWN)')
}
console.log('  (fim — arquivos com DROP que TÊM down: ver manualmente)')
