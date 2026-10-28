// Edge Function: webhooks — motor de entrega dos webhooks de saída (Fase 5C,
// tarefa 4, etapa 4.2). Contrato dos eventos: docs/api/openapi.yaml
// (webhooks) e infra/webhooks.md.
//
// O pg_cron (private.webhook_acordar_motor) chama a cada minuto quando há
// entrega na hora, com o cabeçalho x-motor-segredo. A função:
// 1. pega um lote (public.webhook_lote: reserva cada entrega por 2 minutos);
// 2. assina no padrão Standard Webhooks (assinatura.ts) e envia, 5 por vez,
//    com 10 s de limite e sem seguir redirecionamento;
// 3. devolve cada resultado (public.webhook_resultado decide a próxima
//    tentativa ou "falhou");
// e repete até a fila acabar ou passar 40 s.
//
// Publicar SEM a verificação de JWT do Supabase (quem chama é o cron, com o
// segredo próprio):
//   npx supabase functions deploy webhooks --no-verify-jwt --project-ref <ref>
// O segredo do cabeçalho x-motor-segredo é conferido com o do Vault
// (webhooks_motor_segredo) por public.webhook_motor_autorizado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chaveSecreta } from '../_shared/chaves.ts'
import { relatarErro } from '../_shared/sentry.ts'
import { cabecalhos, enderecoSeguro, resumoErro } from './assinatura.ts'

type Entrega = { id: string; tentativa: number; url: string; segredo: string; corpo: string }

const LOTE = 20
const AO_MESMO_TEMPO = 5
const LIMITE_MS = 10_000
const DURACAO_MS = 40_000

async function enviar(e: Entrega): Promise<{ status: number; erro: string | null }> {
  if (!enderecoSeguro(e.url)) return { status: 0, erro: 'Endereço recusado pelo motor (https com nome público).' }
  try {
    const h = await cabecalhos(e.segredo, e.id, Math.floor(Date.now() / 1000), e.corpo)
    const r = await fetch(e.url, { method: 'POST', headers: h, body: e.corpo, redirect: 'manual', signal: AbortSignal.timeout(LIMITE_MS) })
    const resposta = await r.text().catch(() => '')
    if (r.status >= 200 && r.status < 300) return { status: r.status, erro: null }
    return { status: r.status, erro: resumoErro(r.status, r.status >= 300 && r.status < 400 ? 'redirecionamento não é seguido' : resposta) }
  } catch (err) {
    return { status: 0, erro: resumoErro(0, null, err) }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Não autorizado', { status: 401 })
  const banco = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta(), { auth: { persistSession: false } })
  const quem = await banco.rpc('webhook_motor_autorizado', { p_segredo: req.headers.get('x-motor-segredo') ?? '' })
  if (quem.error || quem.data !== true) return new Response('Não autorizado', { status: 401 })
  const inicio = Date.now()
  let enviadas = 0, entregues = 0
  try {
    while (Date.now() - inicio < DURACAO_MS) {
      const { data, error } = await banco.rpc('webhook_lote', { p_limite: LOTE })
      if (error) throw new Error(error.message)
      const lote = (data ?? []) as Entrega[]
      if (lote.length === 0) break
      for (let i = 0; i < lote.length; i += AO_MESMO_TEMPO) {
        await Promise.all(lote.slice(i, i + AO_MESMO_TEMPO).map(async (e) => {
          const r = await enviar(e)
          const g = await banco.rpc('webhook_resultado', { p_entrega: e.id, p_status: r.status, p_erro: r.erro })
          if (g.error) relatarErro('webhooks', 'resultado', new Error(g.error.message))
          enviadas++
          if (r.erro === null) entregues++
        }))
      }
    }
  } catch (e) {
    relatarErro('webhooks', 'lote', e)
    return new Response(JSON.stringify({ enviadas, entregues, erro: true }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
  return new Response(JSON.stringify({ enviadas, entregues }), { headers: { 'Content-Type': 'application/json' } })
})
