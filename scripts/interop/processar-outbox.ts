// ─────────────────────────────────────────────────────────────────────────────
// Processador da outbox (SEM ENVIO)
//
// Lê itens 'pendente' da interop_outbox e confere que o documento monta.
// NADA sai do status 'pendente'→'enviado': o envio é a 5C-5.3.
//
// RAC e Sumário de Alta: os documentos foram corrigidos na 5C-5.2 contra o
// validador oficial e pedem dados que a carga antiga não trazia (procedimento
// SIGTAP, procedência, desfecho, CBO). A carga entra no serviço de envio
// (5.3, decisão do RT); até lá, estes itens são pulados.
//
// Uso (local/CI, service_role):
//   node scripts/interop/processar-outbox.ts            # processa pendentes
//   node scripts/interop/processar-outbox.ts --id <id>  # um item específico
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { montarBundleRegulacao, type DadosMira } from '../../src/interop/fhir/index.ts'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórias')

const client = createClient(url, key)

type ItemOutbox = {
  id: string
  unidade_id: string
  tipo_documento: string
  referencia_id: string
  payload: Record<string, unknown> | null
}

async function buscarPendentes(): Promise<ItemOutbox[]> {
  const idArg = process.argv.find((a, i) => a === '--id' && process.argv[i + 1])
  const q = client.from('interop_outbox').select('id, unidade_id, tipo_documento, referencia_id, payload')
  if (idArg) q.eq('id', process.argv[process.argv.indexOf('--id') + 1])
  else q.eq('status', 'pendente')
  const { data, error } = await q.order('created_at', { ascending: true }).limit(50)
  if (error) throw new Error(`SELECT outbox: ${error.message}`)
  return (data ?? []) as ItemOutbox[]
}

async function main() {
  const itens = await buscarPendentes()
  console.log(`outbox: ${itens.length} item(ns) pendente(s) — sem envio`)

  for (const item of itens) {
    const rotulo = `${item.tipo_documento} ${item.referencia_id.slice(0, 8)}`
    // 5C-5.1: a regulação guarda o retrato MIRA (payload.mira), que é a fonte.
    // O Bundle sai na hora do envio (5.3), com a hora e o documento anterior;
    // aqui só se confere que ele monta. O payload não muda.
    if (item.tipo_documento === 'regulacao') {
      try {
        const mira = (item.payload as { mira?: DadosMira } | null)?.mira
        if (!mira) throw new Error('item de regulação sem o retrato MIRA')
        const bundle = montarBundleRegulacao(mira, { agora: new Date().toISOString() })
        console.log(`  ${rotulo}: MIRA ${mira.status} monta (${(bundle.entry ?? []).length} recursos)`)
      } catch (err) {
        console.error(`  ${rotulo}: ERRO ao montar o MIRA: ${(err as Error).message}`)
      }
      continue
    }
    console.log(`  ${rotulo}: carga do documento entra no serviço de envio (5.3) — pulado`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
