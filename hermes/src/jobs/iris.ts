// ─────────────────────────────────────────────────────────────────────────────
// GAVIÃO v2 — jobs/iris.ts
// ANDORINHA (Íris) — central de notificações.
//
// Padrão do projeto: notificações SEMPRE via dispatchIris (nunca envio direto).
// Por ora entrega in-app (notificacoes_plantonista) + log; e-mail fica para
// quando a plataforma tiver provedor (decisão anterior).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'

export type NotificacaoIris = {
  perfilId: string
  unidadeId: string | null
  tipo: string
  mensagem: string
  data?: string
}

export async function dispatchIris(n: NotificacaoIris): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const { data, error } = await supabase
    .from('notificacoes_plantonista')
    .insert({
      perfil_id: n.perfilId,
      unidade_id: n.unidadeId,
      tipo: n.tipo,
      mensagem: n.mensagem.slice(0, 500),
      data: n.data ?? new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()

  if (error) {
    logger.warn({ err: error.message, tipo: n.tipo }, '[iris] falha ao notificar')
    return { ok: false, erro: error.message }
  }
  logger.info({ id: data?.id, tipo: n.tipo, perfil: n.perfilId }, '[iris] notificação enviada')
  return { ok: true, id: data?.id }
}

export async function dispatchIrisParaGestores(
  unidadeId: string,
  tipo: string,
  mensagem: string
): Promise<number> {
  const { data: vinculos } = await supabase
    .from('vinculos')
    .select('perfil_id')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .in('papel', ['gestor', 'admin'])

  let enviadas = 0
  for (const v of vinculos ?? []) {
    const r = await dispatchIris({ perfilId: v.perfil_id, unidadeId, tipo, mensagem })
    if (r.ok) enviadas++
  }
  return enviadas
}
