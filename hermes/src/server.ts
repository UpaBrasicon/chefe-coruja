// ─────────────────────────────────────────────────────────────────────────────
// HERMES — server.ts
// Fastify: /health e /webhook (Fase 0 — webhook valida assinatura e enfileira;
// o pipeline completo de processamento vem na Fase 1).
//
// SEGURANÇA (Fase 0):
//  • POST /webhook valida X-Hub-Signature-256 (HMAC-SHA256 do corpo RAW com
//    META_APP_SECRET). Assinatura inválida → 401 + log de warning.
//  • Raw body: Fastify parseia JSON antes — registramos o parser do
//    application/json com parseAs buffer para preservar o corpo original.
//  • Responder 200 à Meta em < 5s SEMPRE; processamento vai para a fila.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto'
import Fastify, { type FastifyRequest } from 'fastify'
import { env } from './config/env.js'
import { logger } from './logger.js'
import { supabase } from './lib/supabase.js'
import { criarConexaoRedis, criarFila, criarWorker, type JobMensagemWhatsApp } from './queue/index.js'

// ── Raw body: preserva o corpo bruto para validação do HMAC ──────────────────
declare module 'fastify' {
  interface FastifyRequest {
    corpoBruto?: Buffer
  }
}

// Registra o parser do JSON como buffer e repassa o objeto parseado ao body,
// guardando o buffer em request.corpoBruto para o HMAC.
function registrarParserCorpoBruto(app: ReturnType<typeof Fastify>) {
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req: FastifyRequest, body: Buffer, done: (err: Error | null, parsed?: unknown) => void) => {
      ;(req as FastifyRequest).corpoBruto = body
      if (body.length === 0) return done(null, {})
      try {
        done(null, JSON.parse(body.toString('utf8')))
      } catch (err) {
        done(err as Error)
      }
    }
  )
}

// ── Validação de assinatura da Meta ──────────────────────────────────────────
function assinaturaValida(corpo: Buffer, header: string | undefined): boolean {
  if (!header) return false
  const esperado = 'sha256=' + createHmac('sha256', env.META_APP_SECRET).update(corpo).digest('hex')
  const a = Buffer.from(header)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

type WebhookPayload = {
  object?: string
  entry?: {
    id?: string
    changes?: {
      field?: string
      value?: {
        messaging_product?: string
        metadata?: { display_phone_number?: string; phone_number_id?: string }
        contacts?: { profile?: { name?: string }; wa_id?: string }[]
        messages?: {
          from?: string
          id?: string
          timestamp?: string
          type?: string
          text?: { body?: string }
        }[]
      }
    }[]
  }[]
}

async function main() {
  const app = Fastify({ logger: false })

  registrarParserCorpoBruto(app)

  // Fila + worker (Fase 0: worker só loga)
  const fila = criarFila()
  const worker = criarWorker()
  const redisHealth = criarConexaoRedis()

  app.addHook('onClose', async () => {
    await fila.close()
    await worker.close()
    redisHealth.disconnect()
  })

  // ── GET /health ────────────────────────────────────────────────────────────
  app.get('/health', async () => {
    let redisOk = false
    let supabaseOk = false

    try {
      const pong = await redisHealth.ping()
      redisOk = pong === 'PONG'
    } catch {
      redisOk = false
    }

    try {
      // Chamada mínima e barata para validar a conexão (tabela pequena).
      const { error } = await supabase.from('unidades').select('id').limit(1)
      supabaseOk = !error
    } catch {
      supabaseOk = false
    }

    return {
      status: redisOk && supabaseOk ? 'ok' : 'degraded',
      uptime: process.uptime(),
      redis: redisOk ? 'connected' : 'disconnected',
      supabase: supabaseOk ? 'connected' : 'disconnected',
      ts: new Date().toISOString(),
    }
  })

  // ── GET /webhook — handshake da Meta ───────────────────────────────────────
  app.get('/webhook', async (req, reply) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } =
      req.query as Record<string, string>

    if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN && challenge) {
      logger.info('[webhook] handshake verificado pela Meta')
      return reply.type('text/plain').send(challenge)
    }

    logger.warn({ mode, token }, '[webhook] handshake rejeitado')
    return reply.code(403).type('text/plain').send('verification failed')
  })

  // ── POST /webhook — mensagens da Meta ──────────────────────────────────────
  app.post('/webhook', async (req, reply) => {
    const corpo = req.corpoBruto ?? Buffer.alloc(0)
    const assinatura = req.headers['x-hub-signature-256'] as string | undefined

    if (!assinaturaValida(corpo, assinatura)) {
      logger.warn({ ip: req.ip }, '[webhook] assinatura inválida → 401')
      return reply.code(401).send({ error: 'invalid signature' })
    }

    const payload = (req.body ?? {}) as WebhookPayload
    logger.info(
      { object: payload.object, entries: payload.entry?.length ?? 0 },
      '[webhook] payload recebido com assinatura válida'
    )

    // Extrai mensagens e enfileira (Fase 1 processa de verdade).
    const jobs: JobMensagemWhatsApp[] = []
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue
        for (const msg of change.value?.messages ?? []) {
          if (msg.id && msg.from) {
            jobs.push({
              message_id: msg.id,
              wa_id: msg.from,
              texto: msg.type === 'text' ? (msg.text?.body ?? '') : '',
              tipo: msg.type === 'text' ? 'text' : 'outro',
              received_at: new Date().toISOString(),
            })
          }
        }
      }
    }

    if (jobs.length > 0) {
      await fila.addBulk(jobs.map((j) => ({ name: 'processar', data: j })))
      logger.info({ quantidade: jobs.length }, '[webhook] mensagens enfileiradas')
    }

    // SEMPRE 200 rápido para a Meta (< 5s).
    return reply.code(200).send({ status: 'ok' })
  })

  const porta = env.PORT
  await app.listen({ port: porta, host: '0.0.0.0' })
  logger.info(`[server] Hermes ouvindo em http://0.0.0.0:${porta}`)
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, '[server] falha fatal ao iniciar')
  process.exit(1)
})
