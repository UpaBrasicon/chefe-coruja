// ─────────────────────────────────────────────────────────────────────────────
// Importação CBO — Classificação Brasileira de Ocupações 2002 (Ministério do Trabalho)
//
// Lê de data/terminologia/cbo/:
//   CBO2002 - Ocupacao.csv   (CODIGO;TITULO — código CBO de 6 dígitos, oficial)
//   (Familia/Sinonimo/PerfilOcupacional não são importados)
//
// Fonte: https://cbo.mte.gov.br/ (zip "ESTRUTURA CBO"). Idempotente: upsert
// por `codigo` (PK).
//
// Uso: node scripts/terminologia/importar-cbo.ts
// ─────────────────────────────────────────────────────────────────────────────
import { resolve } from 'node:path'
import { lerCsv, lerArquivoCsv, coluna, type LinhaCsv } from './lib/csv.ts'
import { importarTabela } from './lib/importar.ts'
import { criarCliente } from './lib/supabase.ts'
import { texto } from './lib/tipos.ts'

const ARQUIVO = resolve('data/terminologia/cbo/CBO2002 - Ocupacao.csv')

function mapear(l: LinhaCsv): Record<string, unknown> | null {
  const codigo = coluna(l, ['codigo', 'co_ocupacao', 'cbo', 'cod', 'codigo_ocupacao'])
  if (!codigo) return null
  return {
    codigo: codigo.trim(),
    titulo: texto(coluna(l, ['titulo', 'no_ocupacao', 'ocupacao', 'nome', 'titulo_ocupacao'])) ?? '',
  }
}

async function main() {
  const linhas = lerCsv(lerArquivoCsv(ARQUIVO))
  console.log(`cbo: ${linhas.length} linhas em ${ARQUIVO}`)

  const client = criarCliente()
  const relatorio = await importarTabela(client, {
    tabela: 'cbo',
    chave: 'codigo',
    colunas: ['titulo'],
    mapear,
  }, linhas)
  console.log(`cbo: ${relatorio.inseridos} inseridos, ${relatorio.atualizados} atualizados, ${relatorio.ignorados} ignorados (total ${relatorio.total})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
