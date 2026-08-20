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
import { parsearLayout, parsearArquivoPosicional, type LinhaPosicional } from './lib/posicional.ts'
import { importarTabela } from './lib/importar.ts'
import { criarCliente } from './lib/supabase.ts'
import { texto, inteiro, numero } from './lib/tipos.ts'

const DIR = resolve('data/terminologia/sigtap')

/** SIGTAP usa 9999 para "sem limite" (idade) e 0 para "sem valor". */
function idadeSigtap(v: string): number | null {
  const n = inteiro(v)
  if (n === null || n === 9999) return null
  return n
}

function valorSigtap(v: string): number | null {
  const n = numero(v)
  if (n === null || n === 0) return null
  return n
}

function mapear(l: LinhaPosicional): Record<string, unknown> | null {
  const codigo = l.CO_PROCEDIMENTO
  if (!codigo) return null
  return {
    codigo: codigo.trim(),
    nome: texto(l.NO_PROCEDIMENTO) ?? '',
    complexidade: texto(l.TP_COMPLEXIDADE),
    sexo: texto(l.TP_SEXO),
    idade_min: idadeSigtap(l.VL_IDADE_MINIMA),
    idade_max: idadeSigtap(l.VL_IDADE_MAXIMA),
    valor_sa: valorSigtap(l.VL_SA),
    valor_sh: valorSigtap(l.VL_SH),
    valor_sp: valorSigtap(l.VL_SP),
    competencia: texto(l.DT_COMPETENCIA),
  }
}

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
      'valor_sa', 'valor_sh', 'valor_sp', 'competencia',
    ],
    mapear,
  }, linhas as never)
  console.log(`sigtap: ${relatorio.inseridos} inseridos, ${relatorio.atualizados} atualizados, ${relatorio.ignorados} ignorados (total ${relatorio.total})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
