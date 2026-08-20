// ─────────────────────────────────────────────────────────────────────────────
// Importação LOINC — observatórios laboratoriais (loinc.org) + variante pt-BR
//
// Fonte: https://loinc.org/downloads/ (zip "Loinc_2.82" → extrair para
// data/terminologia/loinc/):
//   LoincTable/Loinc.csv                          (tabela principal, ~109 mil)
//   AccessoryFiles/LinguisticVariants/ptBR11LinguisticVariant.csv (tradução)
//
// Passo 1 — upsert da tabela principal (LOINC_NUM, COMPONENT, PROPERTY,
//   EXAMPLE_UNITS, LONG_COMMON_NAME, SHORTNAME, CLASS).
// Passo 2 — preenche componente_pt/nome_curto_pt a partir da variante pt-BR
//   (a tradução oficial fica em COMPONENT/SYSTEM/SHORTNAME; LONG_COMMON_NAME
//   da variante vem vazio).
// Idempotente: upsert por `codigo` (PK).
// Uso: node scripts/terminologia/importar-loinc.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { lerCsv, coluna, type LinhaCsv } from './lib/csv.ts'
import { importarTabela, type Relatorio } from './lib/importar.ts'
import { criarCliente, type ClienteTerminologia } from './lib/supabase.ts'
import { texto } from './lib/tipos.ts'

const DIR = resolve('data/terminologia/loinc')
const ARQUIVO = resolve(DIR, 'Loinc.csv')
const ARQUIVO_PTBR = resolve(DIR, 'ptBR11LinguisticVariant.csv')

function mapear(l: LinhaCsv): Record<string, unknown> | null {
  const codigo = coluna(l, ['loinc_num', 'codigo', 'loinc', 'code', 'loincnumber'])
  if (!codigo) return null
  return {
    codigo: codigo.trim(),
    componente: texto(coluna(l, ['component', 'componente', 'componenteanalito'])) ?? '',
    propriedade: texto(coluna(l, ['property', 'propriedade', 'prop', 'propriedademedida'])),
    unidade_exemplo: texto(coluna(l, ['example_units', 'example_ucum_units', 'unidade_exemplo', 'unidade', 'unidadesexemplo'])),
    nome_longo: texto(coluna(l, ['long_common_name', 'nome_longo', 'long_name', 'nomelongocomum'])) ?? '',
    nome_curto: texto(coluna(l, ['shortname', 'nome_curto', 'short_name', 'nomecurto'])),
    classe: texto(coluna(l, ['class', 'classe', 'class_type', 'classetipo'])),
  }
}

function mapearPtBr(l: LinhaCsv): Record<string, unknown> | null {
  const codigo = coluna(l, ['loinc_num', 'codigo', 'loinc', 'code'])
  if (!codigo) return null
  const componentePt = texto(coluna(l, ['component', 'componente_pt', 'componente']))
  const nomeCurtoPt = texto(coluna(l, ['shortname', 'nome_curto_pt', 'nome_curto']))
  // só retorna se houver tradução nova (evita sobrescrever com vazio)
  if (!componentePt && !nomeCurtoPt) return null
  return {
    codigo: codigo.trim(),
    componente_pt: componentePt,
    nome_curto_pt: nomeCurtoPt,
  }
}

/** Passo 2: preenche as colunas pt-BR (upsert parcial, sem tocar no resto). */
async function importarPtBr(client: ClienteTerminologia, linhas: LinhaCsv[]): Promise<Relatorio> {
  // só linhas com tradução
  const comTraducao = linhas.filter((l) => mapearPtBr(l) !== null)
  return importarTabela(client, {
    tabela: 'loinc',
    chave: 'codigo',
    colunas: ['componente_pt', 'nome_curto_pt'],
    mapear: mapearPtBr,
  }, comTraducao)
}

async function main() {
  const linhas = lerCsv(readFileSync(ARQUIVO, 'utf8'))
  console.log(`loinc: ${linhas.length} linhas em ${ARQUIVO}`)

  const client = criarCliente()

  // Passo 1 — tabela principal
  const r1 = await importarTabela(client, {
    tabela: 'loinc',
    chave: 'codigo',
    colunas: ['componente', 'propriedade', 'unidade_exemplo', 'nome_longo', 'nome_curto', 'classe'],
    mapear,
  }, linhas)
  console.log(`loinc: passo 1 → ${r1.inseridos} inseridos, ${r1.atualizados} atualizados, ${r1.ignorados} ignorados (total ${r1.total})`)

  // Passo 2 — variante pt-BR (se existir)
  try {
    const linhasPt = lerCsv(readFileSync(ARQUIVO_PTBR, 'utf8'))
    const r2 = await importarPtBr(client, linhasPt)
    console.log(`loinc: passo 2 (pt-BR) → ${r2.inseridos} inseridos, ${r2.atualizados} atualizados, ${r2.ignorados} ignorados (total ${r2.total})`)
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('ENOENT')) {
      console.log('loinc: variante pt-BR não encontrada — pulando (coloque ptBR11LinguisticVariant.csv em data/terminologia/loinc/)')
    } else {
      throw err
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
