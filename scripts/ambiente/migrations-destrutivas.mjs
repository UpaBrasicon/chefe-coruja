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
  // fim do comando: ";", fim do texto ou fim de literal (EXECUTE 'DELETE FROM t')
  [/\bDELETE\s+FROM\s+[\w."]+\s*(;|'|$)/i, 'DELETE sem WHERE'],
  // WHERE que não filtra nada (S10, H5)
  [/\bDELETE\s+FROM\s+[\w."]+(\s+(AS\s+)?\w+)?\s+WHERE\s+(\(\s*)?(TRUE|1\s*=\s*1|'t'|'true')(\s*\))?\s*(;|'|$|RETURNING\b)/i, 'DELETE com WHERE sempre verdadeiro'],
]

const RE_FUNCAO = /\bCREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|PROCEDURE)\b/i
const RE_DO = /\bDO(\s+LANGUAGE\s+\w+)?\s*$/i

/**
 * Tira comentários de linha e de bloco e o corpo de CREATE FUNCTION/PROCEDURE
 * (código de função não é DDL da migration). O corpo de bloco DO $$…$$ roda na
 * hora: fica, e é limpo do mesmo jeito (S10, H5). Dentro de um DO, texto entre
 * $q$…$q$ é SQL dinâmico e também fica. Fora disso (COMMENT … IS $$…$$), sai.
 * Literais '…' ficam como estão. Puro, para teste.
 */
export function limparSql(sql, dentroDeDo = false) {
  let saida = ''
  let comando = '' // texto do comando atual, desde o último ";", para saber o contexto do $$
  let i = 0
  const anexar = (t) => {
    saida += t
    comando += t
  }
  while (i < sql.length) {
    const c = sql[i]
    const d = sql[i + 1]
    if (c === '-' && d === '-') {
      const fim = sql.indexOf('\n', i)
      i = fim === -1 ? sql.length : fim
      anexar(' ')
      continue
    }
    if (c === '/' && d === '*') {
      const fim = sql.indexOf('*/', i + 2)
      i = fim === -1 ? sql.length : fim + 2
      anexar(' ')
      continue
    }
    if (c === "'") {
      const escape = /[Ee]$/.test(sql.slice(Math.max(0, i - 1), i)) && !/\w[Ee]$/.test(sql.slice(Math.max(0, i - 2), i))
      let j = i + 1
      while (j < sql.length) {
        if (escape && sql[j] === '\\') { j += 2; continue }
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") { j += 2; continue }
          break
        }
        j++
      }
      anexar(sql.slice(i, j + 1))
      i = j + 1
      continue
    }
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))
      if (m && !/[\w$]$/.test(sql.slice(Math.max(0, i - 1), i))) {
        const tag = m[0]
        const fim = sql.indexOf(tag, i + tag.length)
        const corpo = sql.slice(i + tag.length, fim === -1 ? sql.length : fim)
        i = fim === -1 ? sql.length : fim + tag.length
        if (RE_FUNCAO.test(comando)) anexar(' $$ ')
        else if (RE_DO.test(comando)) anexar(` ${limparSql(corpo, true)} `)
        else if (dentroDeDo) anexar(` ${limparSql(corpo, true)} `)
        else anexar(' $$ ')
        continue
      }
    }
    if (c === ';') {
      saida += c
      comando = ''
      i++
      continue
    }
    anexar(c)
    i++
  }
  return saida
}

/** Problemas de um arquivo (lista vazia = ok). Puro, para teste. */
export function analisar(nome, sql, versoesExistentes = []) {
  const versao = nome.slice(0, 14)
  if (versao < CORTE) return []
  const limpo = limparSql(sql)
  const achados = []
  for (const [re, rotulo] of PADROES) if (re.test(limpo)) achados.push(rotulo)
  // DROP FUNCTION que não recria a mesma função no próprio arquivo = RPC sumindo.
  // Recriada = CREATE FUNCTION com o mesmo nome, ou GRANT/REVOKE nela depois do
  // DROP (recriada por EXECUTE num bloco DO; sem ela o GRANT falharia).
  for (const m of limpo.matchAll(/\bDROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?([\w."]+)/gi)) {
    const fn = m[1].replace(/"/g, '').split('.').pop().toLowerCase()
    const depois = limpo.slice(m.index + m[0].length)
    const recria = new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+[\\w."]*\\b${fn}\\s*\\(`, 'i').test(limpo)
      || new RegExp(`\\b(GRANT|REVOKE)\\b[^;]*\\bON\\s+FUNCTION\\s+[\\w."]*\\b${fn}\\s*\\(`, 'i').test(depois)
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
