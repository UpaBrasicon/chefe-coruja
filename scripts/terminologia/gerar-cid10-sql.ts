// ─────────────────────────────────────────────────────────────────────────────
// Gera supabase/homolog/partes/cid10_parteN.sql a partir dos arquivos oficiais
// do DATASUS (data/terminologia/cid10/), para carregar a CID-10 pelo SQL
// Editor da homologação — sem service_role na máquina (import:cid10 exige a
// chave). Mesma montagem de importar-cid10.ts; upsert por `codigo`.
//
// Uso: node scripts/terminologia/gerar-cid10-sql.ts
// ─────────────────────────────────────────────────────────────────────────────
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { lerCsv, lerArquivoCsv } from './lib/csv.ts'
import { montarCid10, type LinhaDatasus } from './lib/cid10.ts'

const DIR = resolve('data/terminologia/cid10')
const SAIDA = resolve('supabase/homolog/partes')
const LIMITE = 550_000 // bytes por parte: cabe no SQL Editor

const ler = (nome: string): LinhaDatasus[] => lerCsv(lerArquivoCsv(resolve(DIR, nome)))
const linhas = montarCid10({
  subcategorias: ler('CID-10-SUBCATEGORIAS.CSV'),
  categorias: ler('CID-10-CATEGORIAS.CSV'),
  grupos: ler('CID-10-GRUPOS.CSV'),
  capitulos: ler('CID-10-CAPITULOS.CSV'),
})

const q = (t: string | null) => (t == null ? 'NULL' : `'${t.replace(/'/g, "''")}'`)
const valores = linhas.map((l) => `(${q(l.codigo)},${q(l.descricao)},${q(l.capitulo)},${q(l.grupo)})`)

const partes: string[][] = [[]]
let tamanho = 0
for (const v of valores) {
  if (tamanho + v.length > LIMITE) { partes.push([]); tamanho = 0 }
  partes[partes.length - 1].push(v)
  tamanho += v.length + 2
}

partes.forEach((p, i) => {
  const sql = `-- CID-10 (DATASUS) — parte ${i + 1} de ${partes.length} (${p.length} códigos).
-- GERADO por scripts/terminologia/gerar-cid10-sql.ts — não editar à mão.
-- Idempotente (upsert por código). Rodar as ${partes.length} partes em ordem.
INSERT INTO terminologia.cid10 (codigo, descricao, capitulo, grupo) VALUES
${p.join(',\n')}
ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao, capitulo = EXCLUDED.capitulo, grupo = EXCLUDED.grupo;

SELECT count(*) AS cid10_carregados FROM terminologia.cid10;
`
  writeFileSync(resolve(SAIDA, `cid10_parte${i + 1}.sql`), sql, 'utf8')
})
console.log(`cid10: ${linhas.length} códigos em ${partes.length} partes (supabase/homolog/partes/cid10_parteN.sql)`)
