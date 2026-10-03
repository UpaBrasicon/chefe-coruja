// ─────────────────────────────────────────────────────────────────────────────
// GAVIÃO v2 — jobs/iris.ts
// ANDORINHA (Íris) — central de notificações.
//
// Padrão do projeto: notificações SEMPRE via dispatchIris (nunca envio direto).
// Por ora entrega in-app (notificacoes_plantonista) + log; e-mail fica para
// quando a plataforma tiver provedor (decisão anterior).
// ─────────────────────────────────────────────────────────────────────────────
import { hojeBrasilia } from '../lib/tempo.js'
import { gestoresDaUnidade, inserirNotificacao } from '../lib/db-job.js'
import { logger } from '../logger.js'

export type NotificacaoIris = {
  perfilId: string
  unidadeId: string | null
  tipo: string
  mensagem: string
  data?: string
}

/** Acesso ao banco da Íris — trocável nos testes (sem rede). */
export type BancoIris = {
  inserirNotificacao: typeof inserirNotificacao
  gestoresDaUnidade: typeof gestoresDaUnidade
}
const BANCO_PADRAO: BancoIris = { inserirNotificacao, gestoresDaUnidade }

export async function dispatchIris(
  n: NotificacaoIris,
  banco: Pick<BancoIris, 'inserirNotificacao'> = BANCO_PADRAO
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const { data, error } = await banco.inserirNotificacao({
    perfil_id: n.perfilId,
    unidade_id: n.unidadeId,
    tipo: n.tipo,
    mensagem: n.mensagem.slice(0, 500),
    data: n.data ?? hojeBrasilia(),
  })

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
  mensagem: string,
  banco: BancoIris = BANCO_PADRAO
): Promise<number> {
  const { data: vinculos } = await banco.gestoresDaUnidade(unidadeId)

  let enviadas = 0
  for (const v of vinculos ?? []) {
    const r = await dispatchIris({ perfilId: v.perfil_id, unidadeId, tipo, mensagem }, banco)
    if (r.ok) enviadas++
  }
  return enviadas
}
