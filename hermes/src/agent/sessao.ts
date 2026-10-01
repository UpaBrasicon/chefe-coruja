// ─────────────────────────────────────────────────────────────────────────────
// HERMES — agent/sessao.ts
// Sessões de conversa (tabela hermes_sessions, criada na migration
// 20260821000001). Janela de contexto: últimas 20 mensagens OU 2h de
// inatividade (o que vier primeiro) — depois disso, sessão nova.
//
// ⚠️ service_role bypassa RLS — nenhum dado sensível; só contexto de conversa.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseUser } from '../lib/supabase.js'
import { logger } from '../logger.js'

export type MensagemSessao = {
  role: 'user' | 'assistant'
  content: string
  ts: string
}

const MAX_MENSAGENS = 20
const INATIVIDADE_MS = 2 * 60 * 60 * 1000 // 2h

export async function carregarSessao(userId: string, waId: string): Promise<MensagemSessao[]> {
  // RPC escopada ao próprio user_id. RETORNA jsonb (as mensagens direto) ou
  // null — NÃO traz updated_at, então a expiração de 2h passa a usar o `ts` da
  // última mensagem (equivalente ao updated_at do upsert).
  const { data, error } = await supabaseUser.rpc('hermes_sessao_carregar', {
    p_perfil: userId,
    p_phone: waId,
  })

  if (error) {
    logger.warn({ err: error.message, userId }, '[sessao] falha ao carregar')
    return []
  }
  if (!data) return []

  const msgs = (data as MensagemSessao[]) ?? []
  if (msgs.length === 0) return []

  const ultimoTs = msgs[msgs.length - 1]?.ts
  if (ultimoTs) {
    const atualizado = new Date(ultimoTs).getTime()
    if (Number.isFinite(atualizado) && Date.now() - atualizado > INATIVIDADE_MS) {
      // Expirou: zera (a sessão antiga é substituída no próximo save).
      return []
    }
  }

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

  // RPC faz o upsert atômico por (user_id, phone) e carimba updated_at=now().
  const { error } = await supabaseUser.rpc('hermes_sessao_salvar', {
    p_perfil: userId,
    p_phone: waId,
    p_messages: janela,
  })
  if (error) logger.warn({ err: error.message }, '[sessao] falha no upsert')
}
