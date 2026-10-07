// Trava expand/contract (Fase 0, item 14 do BACKLOG.md; regras de backend):
// migration nova não pode apagar nem renomear o que a versão anterior do app
// ainda usa — senão o rollback do frontend quebra. A remoção (contract) só vem
// numa release SEGUINTE à que parou de usar a coisa, e assumida no arquivo:
//
//   -- contract: <o que sai e por quê> (expand em <versão da migration expand>)
//
// Vale para as migrations criadas depois da adoção (CORTE). Roda no CI.
// Uso: node scripts/ambiente/migrations-destrutivas.mjs [pasta]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Primeira migration sob a regra (as anteriores já estão em produção). */
export const CORTE = '20261025000002'

const PADROES = [
  [/\bDROP\s+(TABLE|SCHEMA|VIEW|MATERIALIZED\s+VIEW|TYPE|SEQUENCE|DOMAIN)\b/i, 'DROP de objeto com dado ou usado pelo app'],
  [/\bALTER\s+TABLE\b[^;]*\bDROP\s+COLUMN\b/i, 'DROP COLUMN'],
  [/\bRENAME\s+(TO|COLUMN)\b/i, 'RENAME'],
  [/\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i, 'troca de tipo de coluna'],
  [/\bTRUNCATE\b/i, 'TRUNCATE'],
  [/\bDELETE\s+FROM\s+[\w."]+\s*;/i, 'DELETE sem WHERE'],
]

/** Tira comentários de linha e de bloco e o conteúdo de corpos $$...$$ (código de função não é DDL). */
export function limparSql(sql) {
  return sql
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, '$$$$')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
}

/** Problemas de um arquivo (lista vazia = ok). Puro, para teste. */
export function analisar(nome, sql, versoesExistentes = []) {
  const versao = nome.slice(0, 14)
  if (versao < CORTE) return []
  const limpo = limparSql(sql)
  const achados = []
  for (const [re, rotulo] of PADROES) if (re.test(limpo)) achados.push(rotulo)
  // DROP FUNCTION que não recria a mesma função no próprio arquivo = RPC sumindo
  for (const m of limpo.matchAll(/\bDROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?([\w."]+)/gi)) {
    const fn = m[1].replace(/"/g, '').split('.').pop().toLowerCase()
    const recria = new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+[\\w."]*\\b${fn}\\s*\\(`, 'i').test(limpo)
    if (!recria) achados.push(`DROP FUNCTION ${fn} sem recriar`)
  }
  if (!achados.length) return []
  const contrato = sql.match(/--\s*contract:\s*(.+)/i)
  if (contrato) {
    const expand = contrato[1].match(/expand em (\d{14})/i)?.[1]
    if (expand && expand < versao && versoesExistentes.includes(expand)) return []
    return [`${nome}: "-- contract:" precisa citar a migration expand anterior que existe ("expand em AAAAMMDDHHMMSS")`]
  }
  return achados.map((a) => `${nome}: ${a} — expand/contract: remova só numa release seguinte e marque "-- contract: … (expand em <versão>)"`)
}

function principal(pasta = 'supabase/migrations') {
  const arquivos = readdirSync(pasta).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort()
  const versoes = arquivos.map((f) => f.slice(0, 14))
  const problemas = arquivos.flatMap((f) => analisar(f, readFileSync(join(pasta, f), 'utf8'), versoes))
  const sob = arquivos.filter((f) => f.slice(0, 14) >= CORTE).length
  if (problemas.length) {
    console.error(problemas.map((p) => `✖ ${p}`).join('\n'))
    return 1
  }
  console.log(`✔ expand/contract: ${sob} migration(s) desde ${CORTE}, nenhuma destrutiva sem contrato`)
  return 0
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/migrations-destrutivas.mjs')) {
  process.exit(principal(process.argv[2]))
}
