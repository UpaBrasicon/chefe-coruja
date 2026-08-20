// ─────────────────────────────────────────────────────────────────────────────
// Camada de acesso às observações clínicas (FASE 2 — modelo conceito+obs)
//
// getSerieObservacao  → série temporal de um conceito numa internação
// getPainelInternacao → últimos valores por conceito + delta vs. anterior
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Observacao = Database['public']['Tables']['observacao']['Row']
export type Conceito = Database['public']['Tables']['conceito']['Row']

export type FlagObs = 'L' | 'N' | 'H' | 'CRIT'

export type PontoSerie = {
  observacao_id: string
  aferido_em: string
  valor_num: number | null
  valor_texto: string | null
  flag: FlagObs
  unidade: string | null
  origem: string
}

export type SerieObservacao = {
  conceito: Pick<Conceito, 'id' | 'nome' | 'unidade_padrao' | 'ref_min' | 'ref_max' | 'categoria'>
  pontos: PontoSerie[]
}

export type ItemPainel = {
  conceito_id: string
  nome: string
  unidade: string | null
  ref_min: number | null
  ref_max: number | null
  categoria: string
  ultimo: PontoSerie | null
  anterior: PontoSerie | null
  delta: number | null
}

export type PainelInternacao = {
  internacao_id: string
  itens: ItemPainel[]
}

/**
 * Série temporal de um conceito numa internação, ordenada por aferido_em.
 * `periodo` (opcional) limita o intervalo: '24h' | '48h' | '7d' | 'tudo'.
 */
export async function getSerieObservacao(
  internacaoId: string,
  conceitoId: string,
  periodo: '24h' | '48h' | '7d' | 'tudo' = 'tudo'
): Promise<SerieObservacao | null> {
  const desde = periodo === 'tudo' ? null : new Date(Date.now() - parseInt(periodo) * 3600_000).toISOString()

  let query = supabase
    .from('observacao')
    .select('*')
    .eq('internacao_id', internacaoId)
    .eq('conceito_id', conceitoId)
    .order('aferido_em', { ascending: true })
  if (desde) query = query.gte('aferido_em', desde)

  const { data: obs, error } = await query
  if (error) throw new Error(`getSerieObservacao: ${error.message}`)

  const { data: conceito, error: errC } = await supabase
    .from('conceito')
    .select('id, nome, unidade_padrao, ref_min, ref_max, categoria')
    .eq('id', conceitoId)
    .single()
  if (errC) throw new Error(`getSerieObservacao: ${errC.message}`)

  const pontos: PontoSerie[] = (obs ?? []).map((o) => ({
    observacao_id: o.id,
    aferido_em: o.aferido_em,
    valor_num: o.valor_num,
    valor_texto: o.valor_texto,
    flag: (o.flag as FlagObs) ?? 'N',
    unidade: o.unidade ?? conceito.unidade_padrao,
    origem: o.origem,
  }))

  return {
    conceito: {
      id: conceito.id,
      nome: conceito.nome,
      unidade_padrao: conceito.unidade_padrao,
      ref_min: conceito.ref_min,
      ref_max: conceito.ref_max,
      categoria: conceito.categoria,
    },
    pontos,
  }
}

/**
 * Últimos valores por conceito da internação + delta em relação à aferição
 * anterior. Busca as observações mais recentes por conceito (via janela).
 */
export async function getPainelInternacao(internacaoId: string): Promise<PainelInternacao> {
  // 1. conceitos com observações nesta internação
  const { data: conceitosIds, error: err1 } = await supabase
    .from('observacao')
    .select('conceito_id')
    .eq('internacao_id', internacaoId)
    .order('aferido_em', { ascending: false })
  if (err1) throw new Error(`getPainelInternacao: ${err1.message}`)

  const ids = [...new Set((conceitosIds ?? []).map((r) => r.conceito_id))]
  if (ids.length === 0) return { internacao_id: internacaoId, itens: [] }

  const { data: conceitos, error: err2 } = await supabase
    .from('conceito')
    .select('id, nome, unidade_padrao, ref_min, ref_max, categoria')
    .in('id', ids)
  if (err2) throw new Error(`getPainelInternacao: ${err2.message}`)

  // 2. últimas 2 aferições por conceito (janela de 200 por conceito é cara;
  //    busca tudo da internação e agrega no cliente — ok p/ UTI, ~centenas de obs)
  const { data: obs, error: err3 } = await supabase
    .from('observacao')
    .select('id, conceito_id, aferido_em, valor_num, valor_texto, flag, unidade, origem')
    .eq('internacao_id', internacaoId)
    .order('aferido_em', { ascending: false })
  if (err3) throw new Error(`getPainelInternacao: ${err3.message}`)

  const porConceito = new Map<string, PontoSerie[]>()
  for (const o of obs ?? []) {
    const arr = porConceito.get(o.conceito_id) ?? []
    if (arr.length < 2) {
      arr.push({
        observacao_id: o.id,
        aferido_em: o.aferido_em,
        valor_num: o.valor_num,
        valor_texto: o.valor_texto,
        flag: (o.flag as FlagObs) ?? 'N',
        unidade: o.unidade,
        origem: o.origem,
      })
    }
    porConceito.set(o.conceito_id, arr)
  }

  const itens: ItemPainel[] = (conceitos ?? []).map((c) => {
    const [ultimo, anterior] = porConceito.get(c.id) ?? [null, null]
    let delta: number | null = null
    if (ultimo?.valor_num != null && anterior?.valor_num != null) {
      delta = Number((ultimo.valor_num - anterior.valor_num).toFixed(3))
    }
    return {
      conceito_id: c.id,
      nome: c.nome,
      unidade: ultimo?.unidade ?? c.unidade_padrao,
      ref_min: c.ref_min,
      ref_max: c.ref_max,
      categoria: c.categoria,
      ultimo,
      anterior,
      delta,
    }
  })

  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return { internacao_id: internacaoId, itens }
}

/** Cor do flag para UI (flowsheet/gráfico). */
export function corDoFlag(flag: FlagObs | string | null): string {
  switch (flag) {
    case 'CRIT': return 'bg-red-600 text-white'
    case 'H': return 'bg-amber-400 text-amber-950'
    case 'L': return 'bg-sky-300 text-sky-950'
    default: return 'bg-muted text-foreground'
  }
}
