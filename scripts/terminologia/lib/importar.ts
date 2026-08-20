// ─────────────────────────────────────────────────────────────────────────────
// Importação genérica para as tabelas de terminologia.
//
// Idempotente: usa upsert (ON CONFLICT na chave). Para reportar
// inseridos/atualizados/ignorados, consulta o estado atual no banco e compara
// o payload: chave inexistente → inserido; existente com diferença → atualizado;
// existente idêntico → ignorado (nada a fazer).
// ─────────────────────────────────────────────────────────────────────────────
import type { LinhaCsv } from './csv.ts'
import type { ClienteTerminologia } from './supabase.ts'

export type Relatorio = {
  inseridos: number
  atualizados: number
  ignorados: number
  total: number
}

/** Normaliza um valor p/ comparação (null/undefined/'' → null). */
function normalizarValor(v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  if (typeof v === 'string') return v.trim()
  return v
}

/** Compara payload do CSV com o registro existente (ordem irrelevante). */
function payloadIgual(novo: Record<string, unknown>, existente: Record<string, unknown>, colunas: string[]): boolean {
  for (const c of colunas) {
    if (JSON.stringify(normalizarValor(novo[c])) !== JSON.stringify(normalizarValor(existente[c]))) {
      return false
    }
  }
  return true
}

export type OpcoesImportacao = {
  /** Nome da tabela no schema terminologia (sem prefixo). */
  tabela: string
  /** Nome da coluna chave (PK). */
  chave: string
  /** Colunas de dados (sem a chave e sem a coluna gerada `busca`). */
  colunas: string[]
  /**
   * Converte uma linha CSV em payload da tabela.
   * Retorna null para ignorar a linha (dado inválido/incompleto).
   */
  mapear: (linha: LinhaCsv) => Record<string, unknown> | null
  /** Tamanho do lote de upsert. Default 500. */
  lote?: number
}

export async function importarTabela(
  client: ClienteTerminologia,
  opcoes: OpcoesImportacao,
  linhas: LinhaCsv[]
): Promise<Relatorio> {
  const { tabela, chave, colunas, mapear } = opcoes
  const lote = opcoes.lote ?? 500
  const relatorio: Relatorio = { inseridos: 0, atualizados: 0, ignorados: 0, total: 0 }

  // 1. Mapeia e valida; deduplica por chave (1ª ocorrência vence)
  const porChave = new Map<string, Record<string, unknown>>()
  for (const linha of linhas) {
    relatorio.total++
    const payload = mapear(linha)
    if (!payload) {
      relatorio.ignorados++
      continue
    }
    const k = normalizarValor(payload[chave])
    if (k === null || String(k) === '') {
      relatorio.ignorados++
      continue
    }
    if (porChave.has(String(k))) {
      relatorio.ignorados++ // duplicada no arquivo
      continue
    }
    porChave.set(String(k), payload)
  }

  const chaves = [...porChave.keys()]
  const camposSelect = [chave, ...colunas].join(',')

  // 2. Processa em lotes
  for (let i = 0; i < chaves.length; i += lote) {
    const loteChaves = chaves.slice(i, i + lote)

    // 2a. Estado atual das chaves do lote
    const { data, error: errSel } = await client
      .from(tabela)
      .select(camposSelect)
      .in(chave, loteChaves)
    if (errSel) throw new Error(`SELECT ${tabela}: ${errSel.message}`)
    const existentes = (data ?? []) as Record<string, unknown>[]

    const mapaExistente = new Map<string, Record<string, unknown>>()
    for (const r of existentes) {
      mapaExistente.set(String(r[chave]), r)
    }

    // 2b. Classifica
    const paraUpsert: Record<string, unknown>[] = []
    for (const k of loteChaves) {
      const payload = porChave.get(k)!
      const existente = mapaExistente.get(k)
      if (!existente) {
        relatorio.inseridos++
        paraUpsert.push(payload)
      } else if (payloadIgual(payload, existente, colunas)) {
        relatorio.ignorados++
      } else {
        relatorio.atualizados++
        paraUpsert.push(payload)
      }
    }

    // 2c. Upsert (idempotente: ON CONFLICT na chave)
    if (paraUpsert.length > 0) {
      const { error: errUp } = await client.from(tabela).upsert(paraUpsert, { onConflict: chave })
      if (errUp) throw new Error(`UPSERT ${tabela}: ${errUp.message}`)
    }
  }

  return relatorio
}
