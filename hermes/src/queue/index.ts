// ─────────────────────────────────────────────────────────────────────────────
// HERMES — queue/index.ts
// Fila BullMQ para processamento assíncrono das mensagens do WhatsApp.
// O worker executa o pipeline completo da Fase 1 (dedup → identidade → LLM).
// ─────────────────────────────────────────────────────────────────────────────
import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { env } from '../config/env.js'
import { logger } from '../logger.js'
import { processarMensagem } from '../agent/pipeline.js'

export type JobMensagemWhatsApp = {
  message_id: string
  wa_id: string
  texto: string
  tipo: 'text' | 'outro'
  received_at: string
}

export const FILA_MENSAGENS = 'hermes-mensagens'

// Conexão compartilhada (BullMQ exige connection separada por Queue/Worker
// quando usa a mesma instância IORedis — aqui criamos duas de propósito).
// Listener de 'error' evita "Unhandled error event" que derruba o processo
// quando o Redis cai (o ioredis emite error sem listener → crash).
export function criarConexaoRedis(): Redis {
  const conexao = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    connectTimeout: 5_000,
  })
  conexao.on('error', (err) => {
    logger.warn({ err: err.message }, '[redis] erro de conexão')
  })
  return conexao
}

/**
 * Conexão para o /health: com Redis fora do ar, o ping deve FALHAR RÁPIDO em
 * vez de ficar enfileirado (enableOfflineQueue=false) — senão o handler do
 * health fica pendurado até timeout do cliente. Ainda assim RECONECTA com
 * retry (delay 1s) para o status voltar a "ok" quando o Redis retorna.
 */
export function criarConexaoRedisHealth(): Redis {
  const conexao = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    enableOfflineQueue: false,
    retryStrategy: () => 1_000, // reconecta a cada 1s quando cair
  })
  conexao.on('error', () => undefined)
  return conexao
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
  const redisPipeline = criarConexaoRedis() // usada pelo pipeline (dedup/rate limit)
  const worker = new Worker<JobMensagemWhatsApp>(
    FILA_MENSAGENS,
    async (job) => {
      logger.info(
        { message_id: job.data.message_id, wa_id: job.data.wa_id, attempt: job.attemptsMade },
        '[worker] processando mensagem'
      )
      await processarMensagem(
        redisPipeline,
        job.data.message_id,
        job.data.wa_id,
        job.data.texto,
        job.data.tipo
      )
    },
    { connection: criarConexaoRedis() }
  )

  worker.on('failed', (job, err) => {
    logger.error({ message_id: job?.data.message_id, err: err.message }, '[worker] job falhou')
  })

  worker.on('closed', () => redisPipeline.disconnect())

  return worker
}
