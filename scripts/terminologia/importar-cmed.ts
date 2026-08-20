// ─────────────────────────────────────────────────────────────────────────────
// Importação CMED — lista de preços de medicamentos (ANVISA)
//
// Lê o XLSX oficial (aba única "Planilha1"):
//   Cabeçalho na linha 42 (sheet row), dados a partir da linha 43:
//     0 SUBSTÂNCIA · 2 LABORATÓRIO · 4 REGISTRO · 8 PRODUTO · 9 APRESENTAÇÃO
//     10 CLASSE TERAPÊUTICA · 13 PF Sem Impostos · 72 TARJA
//
// Chave primária: hash determinístico de REGISTRO+PRODUTO+APRESENTAÇÃO (o
// arquivo não tem coluna de id único). Idempotente: upsert por `id`.
//
// Fonte: https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos
// Uso: node scripts/terminologia/importar-cmed.ts [caminho-do-xlsx]
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import XLSX from 'xlsx'
import { importarTabela } from './lib/importar.ts'
import { criarCliente } from './lib/supabase.ts'
import { texto, numero } from './lib/tipos.ts'

// A planilha oficial tem um bloco de notas antes da tabela; o cabeçalho fica
// na linha 42 (1-based) e os dados começam na 43. Se a ANVISA mudar o layout,
// ajuste aqui (ou rode o script de verificação antes).
const LINHA_CABECALHO = 42
const LINHA_DADOS = LINHA_CABECALHO + 1

const ARQUIVO_PADRAO = resolve('data/terminologia/cmed.xlsx')

type LinhaCmed = Record<string, string>

function hashId(registro: string, produto: string, apresentacao: string): string {
  return createHash('sha1').update(`${registro}|${produto}|${apresentacao}`).digest('hex').slice(0, 24)
}

function celula(linha: LinhaCmed, chave: string): string {
  return (linha[chave] ?? '').trim()
}

function mapear(l: LinhaCmed): Record<string, unknown> | null {
  const registro = celula(l, 'REGISTRO')
  const produto = celula(l, 'PRODUTO')
  const apresentacao = celula(l, 'APRESENTAÇÃO')
  const substancia = celula(l, 'SUBSTÂNCIA')

  if (!registro && !produto) return null // linha sem dados
  if (!substancia && !produto) return null

  const id = hashId(registro, produto, apresentacao)
  return {
    id,
    principio_ativo: texto(substancia) ?? '',
    produto: texto(produto) ?? '',
    apresentacao: texto(apresentacao),
    laboratorio: texto(celula(l, 'LABORATÓRIO')),
    registro_anvisa: texto(registro),
    classe_terapeutica: texto(celula(l, 'CLASSE TERAPÊUTICA')),
    tarja: texto(celula(l, 'TARJA')),
    pf_sem_impostos: numero(celula(l, 'PF Sem Impostos')),
    competencia: null,
  }
}

function lerXlsx(caminho: string): LinhaCmed[] {
  const wb = XLSX.readFile(caminho, { sheetRows: 0 })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Planilha vazia')
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as unknown[][]

  // valida o cabeçalho (proteção contra mudança de layout da ANVISA)
  const cab = (linhas[LINHA_CABECALHO - 1] ?? []).map((c) => String(c).trim())
  const obrigatorias = ['SUBSTÂNCIA', 'PRODUTO', 'REGISTRO', 'APRESENTAÇÃO', 'PF Sem Impostos']
  for (const o of obrigatorias) {
    if (!cab.includes(o)) {
      throw new Error(`Layout da ANVISA mudou: coluna "${o}" não encontrada na linha ${LINHA_CABECALHO}. Ajuste LINHA_CABECALHO/mapeamento.`)
    }
  }

  const colIndex = new Map<string, number>()
  cab.forEach((nome, idx) => { if (nome) colIndex.set(nome, idx) })

  const resultado: LinhaCmed[] = []
  for (let i = LINHA_DADOS - 1; i < linhas.length; i++) {
    const linha = linhas[i] ?? []
    const obj: LinhaCmed = {}
    for (const [nome, idx] of colIndex) {
      obj[nome] = String(linha[idx] ?? '').trim()
    }
    resultado.push(obj)
  }
  return resultado
}

async function main() {
  const caminho = process.argv[2] ?? ARQUIVO_PADRAO
  const linhas = lerXlsx(caminho)
  console.log(`cmed: ${linhas.length} linhas em ${caminho}`)

  const client = criarCliente()
  const relatorio = await importarTabela(client, {
    tabela: 'medicamento_cmed',
    chave: 'id',
    colunas: [
      'principio_ativo', 'produto', 'apresentacao', 'laboratorio',
      'registro_anvisa', 'classe_terapeutica', 'tarja', 'pf_sem_impostos', 'competencia',
    ],
    mapear,
  }, linhas as never)
  console.log(`cmed: ${relatorio.inseridos} inseridos, ${relatorio.atualizados} atualizados, ${relatorio.ignorados} ignorados (total ${relatorio.total})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
