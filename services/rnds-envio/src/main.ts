// ─────────────────────────────────────────────────────────────────────────────
// Serviço de envio à RNDS (5C-5.3b). Roda no VPS (5.3c), separado do Hermes.
//
// A cada RNDS_INTERVALO_S segundos: um lote da fila, até esvaziar.
//
// Ambiente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   a fila (só as três funções)
//   RNDS_CERTIFICADOS_DIR                     <unidade_id>.pfx e .senha
//   RNDS_AUTH_URL, RNDS_EHR_URL               opcionais: o simulador
//   RNDS_CA_EXTRA                             opcional: arquivo da CA do simulador
//   RNDS_PERMITIR_PRODUCAO=sim                nesta etapa fica sem (decisão do RT)
//   RNDS_INTERVALO_S (60), RNDS_LOTE (20)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { setTimeout as esperar } from 'node:timers/promises'
import { certificadosEmPasta } from './certificados.ts'
import { processarLote } from './ciclo.ts'
import { ClienteRnds } from './cliente-rnds.ts'
import { filaSupabase } from './fila-supabase.ts'

function exigir(nome: string): string {
  const v = process.env[nome]
  if (!v) throw new Error(`${nome} não definida`)
  return v
}

const intervaloMs = Number(process.env.RNDS_INTERVALO_S ?? 60) * 1000
const lote = Number(process.env.RNDS_LOTE ?? 20)
const log = (linha: Record<string, unknown>) => console.log(JSON.stringify({ em: new Date().toISOString(), ...linha }))

const deps = {
  fila: filaSupabase(exigir('SUPABASE_URL'), exigir('SUPABASE_SERVICE_ROLE_KEY')),
  certificados: certificadosEmPasta(exigir('RNDS_CERTIFICADOS_DIR')),
  rnds: new ClienteRnds({ caExtra: process.env.RNDS_CA_EXTRA ? readFileSync(process.env.RNDS_CA_EXTRA, 'utf8') : undefined }),
  sobrepor: {
    ...(process.env.RNDS_AUTH_URL ? { auth: process.env.RNDS_AUTH_URL } : {}),
    ...(process.env.RNDS_EHR_URL ? { ehr: process.env.RNDS_EHR_URL } : {}),
  },
  permitirProducao: process.env.RNDS_PERMITIR_PRODUCAO === 'sim',
  log,
}

let parar = false
for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => { parar = true })

log({ evento: 'inicio', simulador: Boolean(process.env.RNDS_AUTH_URL), producao: deps.permitirProducao })
while (!parar) {
  try {
    // lote cheio: pode haver mais; segue sem esperar
    let r
    do {
      r = await processarLote(deps, lote)
      if (Object.values(r).some((n) => n > 0)) log({ evento: 'lote', ...r })
    } while (!parar && Object.values(r).reduce((a, b) => a + b, 0) >= lote)
  } catch (e) {
    log({ evento: 'falha', erro: (e as Error).message })
  }
  if (!parar) await esperar(intervaloMs)
}
log({ evento: 'fim' })
