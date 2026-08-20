// ─────────────────────────────────────────────────────────────────────────────
// Importação CID-10 (DATASUS — arquivos oficiais)
//
// Lê de data/terminologia/cid10/:
//   CID-10-SUBCATEGORIAS.CSV · CID-10-CATEGORIAS.CSV
//   CID-10-GRUPOS.CSV · CID-10-CAPITULOS.CSV
// e monta ~14,5 mil linhas (categorias + subcategorias) com capitulo/grupo
// resolvidos por faixa. Idempotente: upsert por `codigo` (PK).
//
// Uso: node scripts/terminologia/importar-cid10.ts
// ─────────────────────────────────────────────────────────────────────────────
import { resolve } from 'node:path'
import { lerCsv, lerArquivoCsv } from './lib/csv.ts'
import { montarCid10, type LinhaDatasus } from './lib/cid10.ts'
import { importarTabela } from './lib/importar.ts'
import { criarCliente } from './lib/supabase.ts'

const DIR = resolve('data/terminologia/cid10')

function lerArquivo(nome: string): LinhaDatasus[] {
  return lerCsv(lerArquivoCsv(resolve(DIR, nome)))
}

async function main() {
  const subcategorias = lerArquivo('CID-10-SUBCATEGORIAS.CSV')
  const categorias = lerArquivo('CID-10-CATEGORIAS.CSV')
  const grupos = lerArquivo('CID-10-GRUPOS.CSV')
  const capitulos = lerArquivo('CID-10-CAPITULOS.CSV')
  console.log(
    `cid10: ${categorias.length} categorias + ${subcategorias.length} subcategorias, ` +
    `${grupos.length} grupos, ${capitulos.length} capítulos em ${DIR}`
  )

  const payloads = montarCid10({ subcategorias, categorias, grupos, capitulos })
  console.log(`cid10: ${payloads.length} linhas montadas (ex.: ${payloads[0]?.codigo} ${payloads[0]?.descricao})`)

  const client = criarCliente()
  const relatorio = await importarTabela(client, {
    tabela: 'cid10',
    chave: 'codigo',
    colunas: ['descricao', 'capitulo', 'grupo'],
    mapear: (l) => ({ codigo: l.codigo, descricao: l.descricao, capitulo: l.capitulo ?? null, grupo: l.grupo ?? null }),
  }, payloads as never)
  console.log(`cid10: ${relatorio.inseridos} inseridos, ${relatorio.atualizados} atualizados, ${relatorio.ignorados} ignorados (total ${relatorio.total})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
