// ─────────────────────────────────────────────────────────────────────────────
// Gera o SQL de carga da tabela SIGTAP de procedimentos, a partir da Tabela
// Unificada do DATASUS, para aplicar com:
//   npx supabase db query --local  -f <arquivo>   (banco local)
//   npx supabase db query --linked -f <arquivo>   (projeto ligado)
// Mesmo mapeamento do importador (lib/sigtap.ts). Upsert por código: não apaga
// procedimento antigo. Sai em partes de 1.000 linhas, para caber no limite da
// API de gestão.
//
// Lê de data/terminologia/sigtap/ (tb_procedimento.txt e o layout) e grava em
// data/terminologia/sigtap/sql/procedimento-NN.sql.
// A compatibilidade procedimento × CID continua em scripts/gerar-sigtap-cid-sql.mjs.
//
// Uso: node scripts/terminologia/gerar-sigtap-sql.ts
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { lerArquivoCsv } from './lib/csv.ts'
import { parsearLayout, parsearArquivoPosicional } from './lib/posicional.ts'
import { mapear } from './lib/sigtap.ts'

const DIR = resolve('data/terminologia/sigtap')
const SAIDA = resolve(DIR, 'sql')
const POR_ARQUIVO = 1000
const COLUNAS = ['codigo', 'nome', 'complexidade', 'sexo', 'idade_min', 'idade_max', 'valor_sa', 'valor_sh', 'valor_sp', 'competencia']

const lit = (v: unknown) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)

const layout = parsearLayout(lerArquivoCsv(resolve(DIR, 'tb_procedimento_layout.txt')))
const linhas = parsearArquivoPosicional(lerArquivoCsv(resolve(DIR, 'tb_procedimento.txt')), layout)
const registros = linhas.map(mapear).filter((r): r is Record<string, unknown> => r !== null)
const competencias = new Set(registros.map((r) => r.competencia))
if (competencias.size !== 1) throw new Error(`mais de uma competência: ${[...competencias]}`)

rmSync(SAIDA, { recursive: true, force: true })
mkdirSync(SAIDA, { recursive: true })
let n = 0
for (let i = 0; i < registros.length; i += POR_ARQUIVO) {
  const valores = registros.slice(i, i + POR_ARQUIVO).map((r) => `(${COLUNAS.map((c) => lit(r[c])).join(', ')})`).join(',\n')
  const sql = `-- GERADO por scripts/terminologia/gerar-sigtap-sql.ts — SIGTAP ${[...competencias][0]}, parte ${n + 1}
INSERT INTO terminologia.sigtap_procedimento (${COLUNAS.join(', ')}) VALUES
${valores}
ON CONFLICT (codigo) DO UPDATE SET ${COLUNAS.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(', ')};
`
  n++
  writeFileSync(resolve(SAIDA, `procedimento-${String(n).padStart(2, '0')}.sql`), sql)
}
console.log(`sigtap: ${registros.length} procedimentos, competência ${[...competencias][0]}, ${n} arquivo(s) em ${SAIDA}`)
