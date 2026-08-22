// ─────────────────────────────────────────────────────────────────────────────
// GAVIÃO v2 — jobs/dedup.ts
// Pre-check de deduplicação de incidentes (item A1 da auditoria 22/08).
//
// Por que pre-check e não ON CONFLICT: o PostgREST não emite o predicate de
// índice parcial (WHERE status IN (...)) no ON CONFLICT — ele gera
// `ON CONFLICT (chave_dedup)` sem o WHERE, o que não infere o índice parcial.
// Então o fluxo é: 1) buscar as chaves que JÁ estão abertas, 2) filtrar os
// achados, 3) inserir só os novos. O índice único parcial (migration
// 20260823000001) fica como rede de segurança no banco.
//
// DI leve: o cliente supabase entra por parâmetro (default = singleton) para
// os testes unitários não tocarem a rede.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'

const TAMANHO_LOTE = 100

/**
 * Filtra itens cuja chave de dedup NÃO está no conjunto de chaves abertas.
 * Pura — usada pelos jobs (Argos/Gavião) e testada unitariamente.
 */
export function filtrarNovos<T>(itens: T[], chave: (item: T) => string, abertas: Set<string>): T[] {
  return itens.filter((i) => !abertas.has(chave(i)))
}

/**
 * Retorna o conjunto de chaves que já possuem incidente ABERTO/em_analise.
 * Consulta em lotes de 100 para não estourar o limite de URL do PostgREST
 * com `in=`. Em caso de erro do pre-check, loga e trata como "nenhuma
 * existente" (o insert seguinte falhará junto se o banco estiver fora — o
 * log do insert já cobre esse caso).
 */
export async function chavesJaAbertas(
  chaves: string[],
  cliente: Pick<SupabaseClient, 'from'> = supabase
): Promise<Set<string>> {
  const encontradas = new Set<string>()
  if (chaves.length === 0) return encontradas

  for (let i = 0; i < chaves.length; i += TAMANHO_LOTE) {
    const fatia = chaves.slice(i, i + TAMANHO_LOTE)
    const { data, error } = await cliente
      .from('cerbero_incidentes')
      .select('chave_dedup')
      .in('status', ['aberto', 'em_analise'])
      .in('chave_dedup', fatia)

    if (error) {
      logger.warn({ err: error.message }, '[dedup] pre-check falhou — tratando como sem existentes')
      continue
    }
    for (const r of (data ?? []) as { chave_dedup: string | null }[]) {
      if (r.chave_dedup) encontradas.add(r.chave_dedup)
    }
  }
  return encontradas
}
