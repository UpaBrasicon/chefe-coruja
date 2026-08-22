// ─────────────────────────────────────────────────────────────────────────────
// HERMES v1.1 — queue/agendador.ts
// Agendador BullMQ para os jobs periódicos (Repeat):
//   - sentinela_escala : segunda 06h30 America/Sao_Paulo (fora do pico DeepSeek)
//   - cerbero_dados    : a cada 1h (incoerências de dados)
//   - cerbero_hermes   : diário 05h (ameaças/prompt injection)
//
// ⚠️ Janela de pico do DeepSeek (01–04h e 06–10h UTC = 22–01h e 03–07h BR):
//    os horários acima ficam FORA do pico BR.
// ─────────────────────────────────────────────────────────────────────────────
import { Queue } from 'bullmq'
import { criarConexaoRedis } from './index.js'
import { rodarPatrulhaGaviao } from '../jobs/gaviao.js'
import { gerarRelatorioSemanal } from '../jobs/relatorio.js'
import { rodarAuditoriaArgos } from '../jobs/argos.js'
import { logger } from '../logger.js'
import { rodarSentinela } from '../jobs/sentinela.js'
import { rodarPatrulhaDados, rodarPatrulhaHermes } from '../jobs/cerbero.js'

export const FILA_CRON = 'hermes-cron'

function cronBrasilia(expressao: string): string {
  return expressao // BullMQ usa cron local do processo; o container roda em UTC
}

export function registrarCrons(): Queue {
  const fila = new Queue(FILA_CRON, { connection: criarConexaoRedis() })

  // Segunda 06h30 Brasília = 09h30 UTC (BRT = UTC-3)
  void fila.upsertJobScheduler(
    'sentinela_escala',
    { pattern: cronBrasilia('30 9 * * 1'), tz: 'UTC' },
    { name: 'sentinela_escala', data: {} }
  )

  // Relatório semanal (segunda 08h15 BR = 11h15 UTC — FORA do pico DeepSeek,
  // que vai até 10h UTC)
  void fila.upsertJobScheduler(
    'gaviao_relatorio_semanal',
    { pattern: cronBrasilia('15 11 * * 1'), tz: 'UTC' },
    { name: 'gaviao_relatorio_semanal', data: {} }
  )

  // A cada hora (minuto 5)
  void fila.upsertJobScheduler(
    'cerbero_dados',
    { every: 3_600_000 },
    { name: 'cerbero_dados', data: {} }
  )

  // Diário 05h Brasília = 08h UTC
  void fila.upsertJobScheduler(
    'cerbero_hermes',
    { pattern: cronBrasilia('0 8 * * *'), tz: 'UTC' },
    { name: 'cerbero_hermes', data: {} }
  )

  // Gavião (fiscal do Nous): a cada 12h, nos horários de MENOR custo do
  // DeepSeek. Picos (tarifa dobrada): 01–04h e 06–10h UTC (= 22–01h e 03–07h
  // BR). 11h UTC = 08h BR e 23h UTC = 20h BR ficam FORA dos picos.
  void fila.upsertJobScheduler(
    'gaviao_patrulha',
    { pattern: cronBrasilia('0 11,23 * * *'), tz: 'UTC' },
    { name: 'gaviao_patrulha', data: {} }
  )

  // Falcão (Argos) — auditoria clínica: 2x/dia (06h e 18h BR = 09h e 21h UTC)
  void fila.upsertJobScheduler(
    'argos_auditoria',
    { pattern: cronBrasilia('0 9,21 * * *'), tz: 'UTC' },
    { name: 'argos_auditoria', data: {} }
  )

  logger.info(
    '[cron] jobs: sentinela (seg 06h30 BR), relatorio (seg 08h15 BR), cerbero_dados (1h), cerbero_hermes (05h BR), gaviao_patrulha (08h/20h BR), argos (06h/18h BR)'
  )
  return fila
}

/**
 * Executa um job pelo nome (usado pelo worker da fila hermes-cron).
 */
export async function executarJobCron(nome: string): Promise<void> {
  switch (nome) {
    case 'sentinela_escala':
      await rodarSentinela()
      break
    case 'gaviao_relatorio_semanal':
      await gerarRelatorioSemanal()
      break
    case 'cerbero_dados':
      await rodarPatrulhaDados()
      break
    case 'cerbero_hermes':
      await rodarPatrulhaHermes()
      break
    case 'gaviao_patrulha':
      await rodarPatrulhaGaviao()
      break
    case 'argos_auditoria':
      await rodarAuditoriaArgos()
      break
    default:
      logger.warn({ nome }, '[cron] job desconhecido')
  }
}
