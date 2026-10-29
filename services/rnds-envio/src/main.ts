// ─────────────────────────────────────────────────────────────────────────────
// Serviço de envio à RNDS (5C-5.3b). Roda no VPS (5.3c), separado do Hermes.
//
// A cada RNDS_INTERVALO_S segundos: um lote da fila, até esvaziar.
//
// Ambiente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   a fila e o cofre (só as funções)
//   RNDS_CHAVE_COFRE                          a chave privada do cofre (PEM, 5.4b);
//                                            sem ela, só a pasta
//   RNDS_CERTIFICADOS_DIR                     <unidade_id>.pfx e .senha (a reserva)
//   RNDS_AUTH_URL, RNDS_EHR_URL               opcionais: o simulador
//   RNDS_CA_EXTRA                             opcional: arquivo da CA do simulador
//   RNDS_PERMITIR_PRODUCAO=sim                nesta etapa fica sem (decisão do RT)
//   RNDS_INTERVALO_S (60), RNDS_LOTE (20)
//   RNDS_SAUDE_PORTA (8080)                  GET /saude, para o teste de saúde do
//                                            contêiner e da atualização (5.3c)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { setTimeout as esperar } from 'node:timers/promises'
import { certificadosEmPasta } from './certificados.ts'
import { processarLote } from './ciclo.ts'
import { ClienteRnds } from './cliente-rnds.ts'
import { carregarChave, CofreDeCertificados } from './cofre.ts'
import { clienteSupabase, cofreSupabase, filaSupabase } from './fila-supabase.ts'

function exigir(nome: string): string {
  const v = process.env[nome]
  if (!v) throw new Error(`${nome} não definida`)
  return v
}

const intervaloMs = Number(process.env.RNDS_INTERVALO_S ?? 60) * 1000
const lote = Number(process.env.RNDS_LOTE ?? 20)
const log = (linha: Record<string, unknown>) => console.log(JSON.stringify({ em: new Date().toISOString(), ...linha }))

const db = clienteSupabase(exigir('SUPABASE_URL'), exigir('SUPABASE_SERVICE_ROLE_KEY'))
const pasta = certificadosEmPasta(exigir('RNDS_CERTIFICADOS_DIR'))
// sem o arquivo da chave o serviço não sobe: o teste de saúde falha e a
// atualização volta à versão anterior
const cofre = process.env.RNDS_CHAVE_COFRE
  ? new CofreDeCertificados({ banco: cofreSupabase(db), chave: await carregarChave(readFileSync(process.env.RNDS_CHAVE_COFRE, 'utf8')), reserva: pasta, log })
  : null

const deps = {
  fila: filaSupabase(db),
  certificados: cofre ?? pasta,
  rnds: new ClienteRnds({ caExtra: process.env.RNDS_CA_EXTRA ? readFileSync(process.env.RNDS_CA_EXTRA, 'utf8') : undefined }),
  sobrepor: {
    ...(process.env.RNDS_AUTH_URL ? { auth: process.env.RNDS_AUTH_URL } : {}),
    ...(process.env.RNDS_EHR_URL ? { ehr: process.env.RNDS_EHR_URL } : {}),
  },
  permitirProducao: process.env.RNDS_PERMITIR_PRODUCAO === 'sim',
  log,
}

let parar = false
const acordar = new AbortController()
for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => { parar = true; acordar.abort() })

// Saudável depois de um ciclo que falou com a fila, e enquanto os ciclos
// seguirem falando: sem ciclo bom há três intervalos (banco fora, chave
// errada), responde 503.
let ultimoCicloBom = 0
const saude = createServer((req, res) => {
  const ok = ultimoCicloBom > 0 && Date.now() - ultimoCicloBom < 3 * intervaloMs + 60_000
  res.writeHead(req.url === '/saude' ? (ok ? 200 : 503) : 404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ status: ok ? 'ok' : 'sem ciclo', ultimo_ciclo: ultimoCicloBom ? new Date(ultimoCicloBom).toISOString() : null }))
})
saude.listen(Number(process.env.RNDS_SAUDE_PORTA ?? 8080), '127.0.0.1')

log({ evento: 'inicio', simulador: Boolean(process.env.RNDS_AUTH_URL), producao: deps.permitirProducao, cofre: Boolean(cofre) })
while (!parar) {
  try {
    if (cofre) {
      await cofre.publicarChave()
      await cofre.lerAguardando()
    }
    // lote cheio: pode haver mais; segue sem esperar
    let r
    do {
      r = await processarLote(deps, lote)
      if (Object.values(r).some((n) => n > 0)) log({ evento: 'lote', ...r })
    } while (!parar && Object.values(r).reduce((a, b) => a + b, 0) >= lote)
    ultimoCicloBom = Date.now()
  } catch (e) {
    log({ evento: 'falha', erro: (e as Error).message })
  }
  if (!parar) await esperar(intervaloMs, undefined, { signal: acordar.signal }).catch(() => {})
}
saude.close()
log({ evento: 'fim' })
