// ─────────────────────────────────────────────────────────────────────────────
// HERMES — agent/sessao.ts
// Sessões de conversa (tabela hermes_sessions, criada na migration
// 20260821000001). Janela de contexto: últimas 20 mensagens OU 2h de
// inatividade (o que vier primeiro) — depois disso, sessão nova.
//
// ⚠️ service_role bypassa RLS — nenhum dado sensível; só contexto de conversa.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'

export type MensagemSessao = {
  role: 'user' | 'assistant'
  content: string
  ts: string
}

const MAX_MENSAGENS = 20
const INATIVIDADE_MS = 2 * 60 * 60 * 1000 // 2h

export async function carregarSessao(userId: string, waId: string): Promise<MensagemSessao[]> {
  const { data, error } = await supabase
    .from('hermes_sessions')
    .select('id, messages, updated_at')
    .eq('user_id', userId)
    .eq('phone', waId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.warn({ err: error.message, userId }, '[sessao] falha ao carregar')
    return []
  }
  if (!data) return []

  const atualizado = new Date(data.updated_at).getTime()
  if (Date.now() - atualizado > INATIVIDADE_MS) {
    // Expirou: zera (a sessão antiga é substituída no próximo save).
    return []
  }

  const msgs = (data.messages as MensagemSessao[]) ?? []
  return msgs.slice(-MAX_MENSAGENS)
}

/**
 * Salva o histórico da conversa (janela 20 msgs / 2h).
 * Upsert atômico por (user_id, phone) — usa a UNIQUE INDEX
 * hermes_sessions_user_phone_uniq (migration 20260821000002).
 */
export async function salvarSessao(
  userId: string,
  waId: string,
  mensagens: MensagemSessao[]
): Promise<void> {
  const janela = mensagens.slice(-MAX_MENSAGENS)

  const { error } = await supabase
    .from('hermes_sessions')
    .upsert(
      {
        user_id: userId,
        phone: waId,
        messages: janela,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,phone' }
    )
  if (error) logger.warn({ err: error.message }, '[sessao] falha no upsert')
}
