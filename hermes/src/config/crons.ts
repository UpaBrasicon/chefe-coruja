// ─────────────────────────────────────────────────────────────────────────────
// HERMES — config/crons.ts
// Chave dos crons do Hermes (etapa 2 da migração Hermes → Nous, RT 02/10/2026).
// Quando os vigias passam a valer no cron do Nous (hermes/deploy/nous-vigias),
// HERMES_CRONS=0 no .env.prod desliga o agendador e o worker de cron daqui —
// senão os dois gravariam em dobro (notificações, relatório semanal).
// Ausente ou qualquer outro valor = ligado (o comportamento de sempre).
// Fica fora do config/env.ts para ser testável sem as variáveis obrigatórias.
// ─────────────────────────────────────────────────────────────────────────────

export function cronsHabilitados(valor: string | undefined = process.env.HERMES_CRONS): boolean {
  return (valor ?? '').trim() !== '0'
}
