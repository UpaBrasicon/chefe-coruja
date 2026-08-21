// ─────────────────────────────────────────────────────────────────────────────
// HERMES — queue/index.ts
// Fila BullMQ para processamento assíncrono das mensagens do WhatsApp.
// Na Fase 0, o worker apenas loga o job (o pipeline real vem na Fase 1).
// ─────────────────────────────────────────────────────────────────────────────
import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { env } from '../config/env.js'
import { logger } from '../logger.js'

export type JobMensagemWhatsApp = {
  message_id: string
  wa_id: string
  texto: string
  received_at: string
}

export const FILA_MENSAGENS = 'hermes-mensagens'

// Conexão compartilhada (BullMQ exige connection separada por Queue/Worker
// quando usa a mesma instância IORedis — aqui criamos duas de propósito).
export function criarConexaoRedis(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
}

export function criarFila() {
  return new Queue<JobMensagemWhatsApp>(FILA_MENSAGENS, {
    connection: criarConexaoRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: { age: 86_400 }, // 24h
      removeOnFail: { age: 86_400 },
    },
  })
}

export function criarWorker() {
  const worker = new Worker<JobMensagemWhatsApp>(
    FILA_MENSAGENS,
    async (job) => {
      // Fase 0: apenas loga. O pipeline (dedup → identidade → LLM → resposta)
      // será implementado na Fase 1.
      logger.info(
        { message_id: job.data.message_id, wa_id: job.data.wa_id, attempt: job.attemptsMade },
        '[worker] mensagem recebida (processamento na Fase 1)'
      )
    },
    { connection: criarConexaoRedis() }
  )

  worker.on('failed', (job, err) => {
    logger.error({ message_id: job?.data.message_id, err: err.message }, '[worker] job falhou')
  })

  return worker
}
