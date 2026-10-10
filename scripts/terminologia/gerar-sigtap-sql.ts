// ─────────────────────────────────────────────────────────────────────────────
// Gera o SQL de carga da tabela SIGTAP de procedimentos, a partir da Tabela
// Unificada do DATASUS, para aplicar com:
//   npx supabase db query --local  -f <arquivo>   (banco local)
//   npx supabase db query --linked -f <arquivo>   (projeto ligado)
// Mesmo mapeamento do importador (lib/sigtap.ts). Upsert por código: não apaga
// procedimento antigo. Sai em partes de 1.000 linhas, para caber no limite da
// API de gestão.
//
// Lê de data/terminologia/sigtap/ e grava em data/terminologia/sigtap/sql/:
//   procedimento-NN.sql  tb_procedimento.txt (e o layout)
//   registro-NN.sql      rl_procedimento_registro.txt (instrumento: 01 BPA-C, 02 BPA-I...)
//   ocupacao-NN.sql      rl_procedimento_ocupacao.txt (CBO aceitos)
//   zz-limpa.sql         apaga registro/ocupação de outras competências
// Rodar na ordem dos nomes. A compatibilidade procedimento × CID continua em
// scripts/gerar-sigtap-cid-sql.mjs.
//
// Uso: node scripts/terminologia/gerar-sigtap-sql.ts
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { lerArquivoCsv } from './lib/csv.ts'
import { parsearLayout, parsearArquivoPosicional } from './lib/posicional.ts'
import { mapear } from './lib/sigtap.ts'

const DIR = resolve('data/terminologia/sigtap')
const SAIDA = resolve(DIR, 'sql')
const POR_ARQUIVO = 1000
const COLUNAS = ['codigo', 'nome', 'complexidade', 'sexo', 'idade_min', 'idade_max', 'valor_sa', 'valor_sh', 'valor_sp', 'qt_maxima', 'competencia']
const QUEBRA = String.fromCharCode(10)

const lit = (v: unknown) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)

const layout = parsearLayout(lerArquivoCsv(resolve(DIR, 'tb_procedimento_layout.txt')))
const linhas = parsearArquivoPosicional(lerArquivoCsv(resolve(DIR, 'tb_procedimento.txt')), layout)
const registros = linhas.map(mapear).filter((r): r is Record<string, unknown> => r !== null)
const competencias = new Set(registros.map((r) => r.competencia))
if (competencias.size !== 1) throw new Error(`mais de uma competência: ${[...competencias]}`)
const competencia = [...competencias][0] as string

rmSync(SAIDA, { recursive: true, force: true })
mkdirSync(SAIDA, { recursive: true })
let n = 0
for (let i = 0; i < registros.length; i += POR_ARQUIVO) {
  const valores = registros.slice(i, i + POR_ARQUIVO).map((r) => `(${COLUNAS.map((c) => lit(r[c])).join(', ')})`).join(',' + QUEBRA)
  const sql = `-- GERADO por scripts/terminologia/gerar-sigtap-sql.ts — SIGTAP ${competencia}, parte ${n + 1}
INSERT INTO terminologia.sigtap_procedimento (${COLUNAS.join(', ')}) VALUES
${valores}
ON CONFLICT (codigo) DO UPDATE SET ${COLUNAS.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(', ')};
`
  n++
  writeFileSync(resolve(SAIDA, `procedimento-${String(n).padStart(2, '0')}.sql`), sql)
}

// Relação posicional: procedimento (1–10), código da relação (ini–fim), competência logo depois.
function relacao(arquivo: string, tabela: string, coluna: string, ini: number, fim: number, prefixo: string, porArquivo = 5000): number {
  const texto = readFileSync(resolve(DIR, arquivo), 'latin1')
  const pares = new Map<string, [string, string]>()
  for (const bruta of texto.split(QUEBRA)) {
    const l = bruta.trimEnd()
    if (l.length === 0) continue
    const proc = l.slice(0, 10).trim()
    const cod = l.slice(ini, fim).trim()
    const comp = l.slice(fim, fim + 6)
    if (!/^\d{10}$/.test(proc) || cod === '') throw new Error(`${arquivo}: linha inválida: ${l}`)
    if (comp !== competencia) throw new Error(`${arquivo}: competência ${comp} diferente de ${competencia}`)
    pares.set(`${proc}|${cod}`, [proc, cod])
  }
  const valores = [...pares.values()]
  let partes = 0
  for (let i = 0; i < valores.length; i += porArquivo) {
    partes++
    const v = valores.slice(i, i + porArquivo).map(([p, c]) => `('${p}', '${c}', '${competencia}')`).join(',' + QUEBRA)
    writeFileSync(resolve(SAIDA, `${prefixo}-${String(partes).padStart(2, '0')}.sql`),
      `-- GERADO por scripts/terminologia/gerar-sigtap-sql.ts — SIGTAP ${competencia}, ${arquivo}, parte ${partes}
INSERT INTO terminologia.${tabela} (procedimento, ${coluna}, competencia) VALUES
${v}
ON CONFLICT (procedimento, ${coluna}) DO UPDATE SET competencia = EXCLUDED.competencia;
`)
  }
  console.log(`sigtap: ${valores.length} linhas de ${tabela} em ${partes} arquivo(s)`)
  return valores.length
}
relacao('rl_procedimento_registro.txt', 'sigtap_procedimento_registro', 'registro', 10, 12, 'registro')
relacao('rl_procedimento_ocupacao.txt', 'sigtap_procedimento_ocupacao', 'cbo', 10, 16, 'ocupacao')
writeFileSync(resolve(SAIDA, 'zz-limpa.sql'), `-- GERADO — remove relações de outras competências (rodar por último)
DELETE FROM terminologia.sigtap_procedimento_registro WHERE competencia <> '${competencia}';
DELETE FROM terminologia.sigtap_procedimento_ocupacao WHERE competencia <> '${competencia}';
`)
console.log(`sigtap: ${registros.length} procedimentos, competência ${competencia}, ${n} arquivo(s) em ${SAIDA}`)
