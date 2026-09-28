// Busca inteligente da Central: intermedia o app e a API "biblioteca" no VPS.
// - Autentica pelo JWT do usuário e confere o vínculo ativo com a unidade
//   (ou super admin). tenant_id enviado à biblioteca = unidade_id.
// - Pseudonimiza a pergunta antes de sair (CPF, CNS, telefone, data) e grava
//   o log só com a versão mascarada.
// - Limite: 30 perguntas "ask" por usuário por hora.
// - Repassa o stream NDJSON da biblioteca sem armazenar a resposta.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PII: [RegExp, string][] = [
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]'],
  [/\b\d{15}\b/g, '[CNS]'],
  [/\b\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, '[TEL]'],
  [/\b\d{2}\/\d{2}\/\d{4}\b/g, '[DATA]'],
  [/\b(prontu[aá]rio|registro|leito|atendimento)\s*n?[ºo°.]?\s*\d+\b/gi, '[ID]'],
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[EMAIL]'],
]
const redact = (s: string) => PII.reduce((t, [r, x]) => t.replace(r, x), s)

const erro = (status: number, msg: string) =>
  new Response(JSON.stringify({ erro: msg }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return erro(405, 'método não permitido')
  const t0 = Date.now()

  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return erro(401, 'não autenticado')

  let corpo: { q?: unknown; mode?: unknown; unidade_id?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return erro(400, 'corpo inválido')
  }
  const q = typeof corpo.q === 'string' ? corpo.q.trim() : ''
  const mode = corpo.mode === 'ask' ? 'ask' : corpo.mode === 'search' ? 'search' : null
  const unidadeId = typeof corpo.unidade_id === 'string' ? corpo.unidade_id : ''
  if (q.length < 2 || q.length > 800 || !mode || !/^[0-9a-f-]{36}$/i.test(unidadeId)) return erro(400, 'pedido inválido')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Vínculo ativo com a unidade, ou super admin.
  const { data: vinculo } = await admin.from('vinculos').select('id')
    .eq('perfil_id', user.id).eq('unidade_id', unidadeId).eq('ativo', true).limit(1).maybeSingle()
  if (!vinculo) {
    const { data: sa } = await admin.from('super_admins').select('perfil_id').eq('perfil_id', user.id).maybeSingle()
    if (!sa) return erro(403, 'sem vínculo com a unidade')
  }

  if (mode === 'ask') {
    const { count } = await admin.from('clinical_search_logs').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('mode', 'ask').gte('created_at', new Date(Date.now() - 3600e3).toISOString())
    if ((count ?? 0) >= 30) return erro(429, 'limite de 30 perguntas por hora atingido')
  }

  const request_id = crypto.randomUUID()
  const qRed = redact(q)
  const base = Deno.env.get('BIBLIOTECA_URL')
  const chave = Deno.env.get('BIBLIOTECA_API_KEY')
  let upstream: Response | null = null
  if (base && chave) {
    upstream = await fetch(`${base}/v1/${mode}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: qRed, tenant_id: unidadeId, request_id }),
      signal: AbortSignal.timeout(mode === 'ask' ? 120_000 : 45_000),
    }).catch((e: unknown) => {
      console.error('biblioteca indisponível', request_id, e instanceof Error ? e.message : String(e))
      return null
    })
  }

  await admin.from('clinical_search_logs').insert({
    request_id, user_id: user.id, unidade_id: unidadeId, mode, query_redacted: qRed,
    status: upstream?.status ?? 503, latency_ms: Date.now() - t0,
  })

  if (!upstream) return erro(503, 'biblioteca indisponível')
  if (!upstream.ok) return erro(upstream.status === 401 ? 502 : upstream.status, 'biblioteca recusou o pedido')
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'no-store',
      'X-Request-Id': request_id,
    },
  })
})
