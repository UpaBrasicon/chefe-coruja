// Edge Function: api — API para integradores (Fase 3, tarefa 7).
//
// Contrato: docs/api/openapi.yaml. Fica atrás de api.chefecoruja.com.br/v1
// (Cloudflare, passo a passo em docs/api/implantacao.md).
//
// 1. Confere a rota e os parâmetros (contrato.ts).
// 2. Chama public.api_v1 com a chave secreta da plataforma; essa função só é
//    executável por service_role. Ela confere chave, validade, limite, IP e
//    escopo e registra a consulta.
// 3. Devolve JSON ou application/problem+json (RFC 9457), com os cabeçalhos
//    RateLimit-* e X-Request-Id.
//
// Publicar SEM a verificação de JWT do Supabase (o integrador usa a chave
// dele, não um login):
//   npx supabase functions deploy api --no-verify-jwt --project-ref <ref>
// Segredo opcional API_BORDA_SEGREDO: o mesmo que a borda (Cloudflare) manda
// no cabeçalho X-Coruja-Borda, para o IP do X-Coruja-IP-Cliente valer.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chaveSecreta } from '../_shared/chaves.ts'
import { relatarErro } from '../_shared/sentry.ts'
import { caminhoDaApi, chaveDoCabecalho, interpretar, ipDeOrigem, problema, type CodigoErro } from './contrato.ts'

type Limite = { limite: number; restante: number; reinicio: number }
type RespostaBanco = { status: number; corpo?: unknown; codigo?: CodigoErro; detalhe?: string; limite?: Limite }

function responder(status: number, corpo: unknown, requisicao: string, limite?: Limite, problemaJson = false) {
  const h: Record<string, string> = {
    'Content-Type': problemaJson ? 'application/problem+json' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Request-Id': requisicao,
  }
  if (limite) {
    h['RateLimit-Limit'] = String(limite.limite)
    h['RateLimit-Remaining'] = String(limite.restante)
    h['RateLimit-Reset'] = String(limite.reinicio)
    if (status === 429) h['Retry-After'] = String(limite.reinicio)
  }
  return new Response(JSON.stringify(corpo), { status, headers: h })
}

const erro = (status: number, codigo: CodigoErro, detalhe: string | undefined, requisicao: string, limite?: Limite) =>
  responder(status, problema(status, codigo, detalhe, requisicao), requisicao, limite, true)

Deno.serve(async (req) => {
  const requisicao = crypto.randomUUID()
  if (req.method !== 'GET') return erro(405, 'requisicao_invalida', 'A API só aceita GET.', requisicao)

  const url = new URL(req.url)
  const pedido = interpretar(caminhoDaApi(url.pathname), url.searchParams)
  if ('erro' in pedido) return erro(pedido.erro.status, pedido.erro.codigo, pedido.erro.detalhe, requisicao)

  const chave = chaveDoCabecalho(req.headers.get('Authorization'))
  if (!chave) return erro(401, 'chave_invalida', 'Mande a chave no cabeçalho Authorization: Bearer <chave>.', requisicao)

  const ip = ipDeOrigem((n) => req.headers.get(n), Deno.env.get('API_BORDA_SEGREDO') || undefined)
  try {
    const banco = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta(), { auth: { persistSession: false } })
    const { data, error } = await banco.rpc('api_v1', {
      p_chave: chave, p_ip: ip, p_requisicao: requisicao, p_recurso: pedido.recurso, p_params: pedido.params,
    })
    if (error) throw new Error(error.message)
    const r = data as RespostaBanco
    if (r.status === 200) return responder(200, r.corpo, requisicao, r.limite)
    return erro(r.status, r.codigo ?? 'erro_interno', r.detalhe, requisicao, r.limite)
  } catch (e) {
    relatarErro('api', pedido.recurso, e)
    return erro(500, 'erro_interno', undefined, requisicao)
  }
})
