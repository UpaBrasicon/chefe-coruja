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
import { cadeiaAuditoria, guardiaoProntuario, vigiaEscala, vigiaPorta, vigiaPresenca, vigiaTardios } from '../jobs/vigias.js'

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

  // ── Rodada D (27/09): agentes novos, sem LLM (horários em UTC; BR = UTC−3) ──
  // Porta: virada de plantão, 07h05 e 19h05 BR
  void fila.upsertJobScheduler('vigia_porta', { pattern: '5 10,22 * * *', tz: 'UTC' }, { name: 'vigia_porta', data: {} })
  // Presença: a cada 15 min
  void fila.upsertJobScheduler('vigia_presenca', { pattern: '*/15 * * * *', tz: 'UTC' }, { name: 'vigia_presenca', data: {} })
  // Buraco na escala e registros tardios: 08h BR
  void fila.upsertJobScheduler('vigia_escala', { pattern: '0 11 * * *', tz: 'UTC' }, { name: 'vigia_escala', data: {} })
  void fila.upsertJobScheduler('vigia_tardios', { pattern: '2 11 * * *', tz: 'UTC' }, { name: 'vigia_tardios', data: {} })
  // Guardião do prontuário: de hora em hora (minuto 20)
  void fila.upsertJobScheduler('guardiao_prontuario', { pattern: '20 * * * *', tz: 'UTC' }, { name: 'guardiao_prontuario', data: {} })
  // Cadeia de auditoria: 04h BR
  void fila.upsertJobScheduler('cadeia_auditoria', { pattern: '0 7 * * *', tz: 'UTC' }, { name: 'cadeia_auditoria', data: {} })

  logger.info(
    '[cron] jobs: sentinela (seg 06h30 BR), relatorio (seg 08h15 BR), cerbero_dados (1h), cerbero_hermes (05h BR), gaviao_patrulha (08h/20h BR), argos (06h/18h BR), vigias: porta (07h05/19h05), presença (15 min), escala e tardios (08h), guardião (1 h), cadeia (04h)'
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
    case 'vigia_porta':
      await vigiaPorta()
      break
    case 'vigia_presenca':
      await vigiaPresenca()
      break
    case 'vigia_escala':
      await vigiaEscala()
      break
    case 'vigia_tardios':
      await vigiaTardios()
      break
    case 'guardiao_prontuario':
      await guardiaoProntuario()
      break
    case 'cadeia_auditoria':
      await cadeiaAuditoria()
      break
    default:
      logger.warn({ nome }, '[cron] job desconhecido')
  }
}
