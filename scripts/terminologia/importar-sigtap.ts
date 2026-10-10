// ─────────────────────────────────────────────────────────────────────────────
// Importação SIGTAP — procedimentos (DATASUS, Tabela Unificada)
//
// Lê de data/terminologia/sigtap/:
//   tb_procedimento.txt        (posicional, Windows-1252)
//   tb_procedimento_layout.txt (descrição das colunas)
//
// Baixe primeiro com: node scripts/terminologia/baixar-sigtap.ts
// (mirror automático do FTP do DATASUS — RenatoKR/SIGTAP no GitHub).
// Idempotente: upsert por `codigo` (PK).
//
// Uso: node scripts/terminologia/importar-sigtap.ts
// ─────────────────────────────────────────────────────────────────────────────
import { resolve } from 'node:path'
import { lerArquivoCsv } from './lib/csv.ts'
import { parsearLayout, parsearArquivoPosicional } from './lib/posicional.ts'
import { importarTabela } from './lib/importar.ts'
import { criarCliente } from './lib/supabase.ts'
import { mapear } from './lib/sigtap.ts'

const DIR = resolve('data/terminologia/sigtap')

async function main() {
  const layout = parsearLayout(lerArquivoCsv(resolve(DIR, 'tb_procedimento_layout.txt')))
  const linhas = parsearArquivoPosicional(
    lerArquivoCsv(resolve(DIR, 'tb_procedimento.txt')),
    layout
  )
  console.log(`sigtap: ${linhas.length} linhas em ${DIR} (layout: ${layout.length} colunas)`)

  const client = criarCliente()
  const relatorio = await importarTabela(client, {
    tabela: 'sigtap_procedimento',
    chave: 'codigo',
    colunas: [
      'nome', 'complexidade', 'sexo', 'idade_min', 'idade_max',
      'valor_sa', 'valor_sh', 'valor_sp', 'qt_maxima', 'competencia',
    ],
    mapear,
  }, linhas as never)
  console.log(`sigtap: ${relatorio.inseridos} inseridos, ${relatorio.atualizados} atualizados, ${relatorio.ignorados} ignorados (total ${relatorio.total})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
