// ─────────────────────────────────────────────────────────────────────────────
// HERMES — lib/whatsapp.ts
// Envio de mensagens via WhatsApp Cloud API (Graph).
// POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
// ─────────────────────────────────────────────────────────────────────────────
import { env } from '../config/env.js'
import { logger } from '../logger.js'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

export async function enviarTexto(waId: string, texto: string): Promise<{ ok: boolean; id?: string; erro?: string }> {
  if (!env.META_ACCESS_TOKEN || !env.META_PHONE_NUMBER_ID) {
    return { ok: false, erro: 'WhatsApp não configurado (META_ACCESS_TOKEN/PHONE_NUMBER_ID)' }
  }

  try {
    const res = await fetch(`${GRAPH_BASE}/${env.META_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: waId,
        type: 'text',
        text: { body: texto, preview_url: false },
      }),
      signal: AbortSignal.timeout(15_000),
    })

    const dados = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { message?: string } }
    if (!res.ok) {
      logger.warn({ waId, status: res.status, erro: dados.error?.message }, '[whatsapp] falha ao enviar')
      return { ok: false, erro: dados.error?.message ?? `HTTP ${res.status}` }
    }
    return { ok: true, id: dados.messages?.[0]?.id }
  } catch (err) {
    logger.warn({ waId, err: (err as Error).message }, '[whatsapp] exceção ao enviar')
    return { ok: false, erro: (err as Error).message }
  }
}
