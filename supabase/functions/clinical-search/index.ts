// Busca inteligente da Central: intermedia o app e a API "biblioteca" no VPS.
// - Autentica pelo JWT do usuário e confere o vínculo ativo com a unidade
//   (ou super admin). tenant_id enviado à biblioteca = unidade_id.
// - Fase 8 (ADR 0006): a pergunta passa pelo desidentificador do gateway de IA
//   (cópia em ../_shared/desidentificacao.ts) antes de sair: nomes de
//   pacientes e profissionais da unidade, CPF/CNS com dígito válido, telefone,
//   e-mail, CEP, data e prontuário viram pseudônimos. Sobrou resíduo com cara
//   de identificador: a pergunta não sai (falha fechada). O log guarda só a
//   versão limpa.
// - Limite: 30 perguntas "ask" por usuário por hora.
// - Repassa o stream NDJSON da biblioteca sem armazenar a resposta.
import { createClient } from 'npm:@supabase/supabase-js@2'

import { criarCofre, desidentificar, residuos, type Conhecido } from '../_shared/desidentificacao.ts'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// A mesma máscara de antes, como segunda camada depois do gateway.
const PII: [RegExp, string][] = [
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]'],
  [/\b\d{15}\b/g, '[CNS]'],
  [/\b\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, '[TEL]'],
  [/\b\d{2}\/\d{2}\/\d{4}\b/g, '[DATA]'],
  [/\b(prontu[aá]rio|registro|leito|atendimento)\s*n?[ºo°.]?\s*\d+\b/gi, '[ID]'],
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[EMAIL]'],
]
const redact = (s: string) => PII.reduce((t, [r, x]) => t.replace(r, x), s)

/** Nomes que o servidor sabe serem de pessoas desta unidade: saem sempre. */
async function nomesConhecidos(admin: ReturnType<typeof createClient>, unidadeId: string, userId: string): Promise<Conhecido[]> {
  const [pac, vin, eu] = await Promise.all([
    admin.from('pacientes').select('nome, nome_social, nome_mae, responsavel_nome').eq('unidade_id', unidadeId).eq('ativo', true).limit(20000),
    admin.from('vinculos').select('perfis(nome_completo)').eq('unidade_id', unidadeId).eq('ativo', true).limit(5000),
    admin.from('perfis').select('nome_completo').eq('id', userId).maybeSingle(),
  ])
  const nomes: Conhecido[] = []
  for (const p of (pac.data ?? []) as Record<string, string | null>[]) {
    if (p.nome) nomes.push({ valor: p.nome, categoria: 'PACIENTE' })
    if (p.nome_social) nomes.push({ valor: p.nome_social, categoria: 'PACIENTE' })
    if (p.nome_mae) nomes.push({ valor: p.nome_mae, categoria: 'PESSOA' })
    if (p.responsavel_nome) nomes.push({ valor: p.responsavel_nome, categoria: 'PESSOA' })
  }
  for (const v of (vin.data ?? []) as { perfis: { nome_completo?: string } | null }[]) {
    if (v.perfis?.nome_completo) nomes.push({ valor: v.perfis.nome_completo, categoria: 'PESSOA' })
  }
  const meu = (eu.data as { nome_completo?: string } | null)?.nome_completo
  if (meu) nomes.push({ valor: meu, categoria: 'PESSOA' })
  // nome completo e também o primeiro + último nome ("Maria Silva" de "Maria da Silva Souza")
  const extra: Conhecido[] = []
  for (const n of nomes) {
    const partes = n.valor.trim().split(/\s+/).filter((x) => x.length >= 3 && !/^(da|de|do|das|dos)$/i.test(x))
    if (partes.length >= 3) extra.push({ valor: `${partes[0]} ${partes[partes.length - 1]}`, categoria: n.categoria })
  }
  return [...nomes, ...extra]
}

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
  // Gateway (ADR 0006): desidentifica, confere resíduo, e só então envia.
  const limpo = desidentificar(q, criarCofre(), await nomesConhecidos(admin, unidadeId, user.id))
  const sobras = residuos(limpo.texto)
  const qRed = redact(limpo.texto)
  if (sobras.length) {
    await admin.from('clinical_search_logs').insert({
      request_id, user_id: user.id, unidade_id: unidadeId, mode, query_redacted: qRed, status: 422, latency_ms: Date.now() - t0,
    })
    return erro(422, 'A pergunta parece ter identificação de paciente (' + sobras.map((r) => r.tipo).join(', ') +
      '). Tire o dado e pergunte de novo: a busca não envia identificação para a IA.')
  }
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
