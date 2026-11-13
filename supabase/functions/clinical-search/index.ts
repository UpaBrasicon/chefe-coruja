// Busca inteligente da Central: intermedia o app e a API "biblioteca" no VPS.
// - Autentica pelo JWT do usuário e confere o vínculo ativo com a unidade
//   (ou super admin). tenant_id enviado à biblioteca = unidade_id.
// - Fase 8 (ADR 0006): a pergunta passa pelo desidentificador do gateway de IA
//   (cópia em ../_shared/desidentificacao.ts) antes de sair: nomes de
//   pacientes e profissionais da unidade, CPF/CNS com dígito válido, telefone,
//   e-mail, CEP, data e prontuário viram pseudônimos. Sobrou resíduo com cara
//   de identificador: a pergunta não sai (falha fechada). O log guarda só a
//   versão limpa.
// - E2 da trilha Hermes / Evidências (12/11/2026): a liberação fica em
//   liberar.ts, e a chamada à biblioteca só aceita a pergunta liberada. No modo
//   "ask", o NER da biblioteca (/v1/deid) também confere nomes; NER fora do ar
//   ou sem o modelo carregado: a pergunta não sai (503). Cada pergunta ao modelo
//   deixa uma linha em ia_gateway_log (contagens, tipos e hash, nunca o texto).
// - Limite: 30 perguntas "ask" por usuário por hora.
// - Repassa o stream NDJSON da biblioteca sem armazenar a resposta.
import { createClient } from 'npm:@supabase/supabase-js@2'

import { type Conhecido, type Contagem } from '../_shared/desidentificacao.ts'
import { comCors } from '../_shared/cors.ts'
import { chavePublica, chaveSecreta } from '../_shared/chaves.ts'
import { comRelato, relatarErro } from '../_shared/sentry.ts'
import { hashEntrada, liberarPergunta, TIPO_NOME_NER, type PerguntaLiberada } from './liberar.ts'

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

// a origem do CORS é decidida por requisição (www e sem www): ver _shared/cors.ts
Deno.serve(comRelato('clinical-search', async (req) => comCors(req, await tratar(req))))

async function tratar(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return erro(405, 'método não permitido')
  const t0 = Date.now()

  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, chavePublica(), {
    global: { headers: { Authorization: auth } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return erro(401, 'não autenticado')

  let corpo: { q?: unknown; mode?: unknown; unidade_id?: unknown; publico?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return erro(400, 'corpo inválido')
  }
  const q = typeof corpo.q === 'string' ? corpo.q.trim() : ''
  const mode = corpo.mode === 'ask' ? 'ask' : corpo.mode === 'search' ? 'search' : null
  const unidadeId = typeof corpo.unidade_id === 'string' ? corpo.unidade_id : ''
  // modo do paciente na Central (R2-13): pergunta de criança só busca em fonte pediátrica
  const publico = corpo.publico === 'pediatrico' || corpo.publico === 'adulto' ? corpo.publico : undefined
  if (q.length < 2 || q.length > 800 || !mode || !/^[0-9a-f-]{36}$/i.test(unidadeId)) return erro(400, 'pedido inválido')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta())

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
  const base = Deno.env.get('BIBLIOTECA_URL')
  const chave = Deno.env.get('BIBLIOTECA_API_KEY')
  if (!base || !chave) return erro(503, 'biblioteca indisponível')

  // Gateway (ADR 0006; E2 da trilha Hermes / Evidências): a pergunta só sai
  // liberada. Ver liberar.ts.
  const hash = await hashEntrada(q)
  const liberacao = await liberarPergunta(q, await nomesConhecidos(admin, unidadeId, user.id), mode, (texto) =>
    fetch(`${base}/v1/deid`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
      // a busca simples espera menos: sem o NER ela segue, só sem registro do texto
      signal: AbortSignal.timeout(mode === 'ask' ? 8_000 : 3_000),
    }).then((r) => (r.ok ? r.json() : null)))

  if (liberacao.tipo !== 'ok') {
    const status = liberacao.tipo === 'bloqueada' ? 422 : 503
    await admin.from('clinical_search_logs').insert({
      request_id, user_id: user.id, unidade_id: unidadeId, mode, query_redacted: '[não enviada]', status, latency_ms: Date.now() - t0,
    })
    if (mode === 'ask') {
      await registrarGateway(admin, {
        perfilId: user.id, bloqueado: true, contagem: liberacao.contagem, hash,
        residuos: liberacao.tipo === 'bloqueada' ? Object.values(liberacao.tipos).reduce((a, b) => a + b, 0) : 0,
        tipos: liberacao.tipo === 'bloqueada' ? liberacao.tipos : undefined,
        erro: liberacao.tipo === 'indisponivel' ? `desidentificação indisponível: ${liberacao.motivo}` : undefined,
      })
    }
    if (liberacao.tipo === 'indisponivel') {
      relatarErro('clinical-search', 'deid_indisponivel', liberacao.motivo)
      return erro(503, 'A conferência de identificação está fora do ar, e a pergunta não foi enviada. Tente de novo em instantes.')
    }
    if (liberacao.tipos[TIPO_NOME_NER]) {
      return erro(422, 'A pergunta parece ter o nome de uma pessoa. Tire o nome e pergunte de novo: a busca não envia identificação para a IA.')
    }
    return erro(422, 'A pergunta parece ter identificação de paciente (' + Object.keys(liberacao.tipos).join(', ') +
      '). Tire o dado e pergunte de novo: a busca não envia identificação para a IA.')
  }

  const qRed = liberacao.registro === null ? '[não registrada]' : redact(liberacao.registro)
  const upstream = await chamarBiblioteca(base, chave, mode, liberacao.texto, { tenant_id: unidadeId, request_id, publico })

  await admin.from('clinical_search_logs').insert({
    request_id, user_id: user.id, unidade_id: unidadeId, mode, query_redacted: qRed,
    status: upstream?.status ?? 503, latency_ms: Date.now() - t0,
  })
  if (mode === 'ask') {
    await registrarGateway(admin, {
      perfilId: user.id, bloqueado: false, contagem: liberacao.contagem, hash, residuos: 0,
      latenciaMs: Date.now() - t0, erro: upstream?.ok ? undefined : `biblioteca: ${upstream?.status ?? 'sem resposta'}`,
    })
  }

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
}

/** A única chamada à biblioteca: só aceita a pergunta liberada (liberar.ts). */
function chamarBiblioteca(
  base: string, chave: string, mode: 'ask' | 'search', pergunta: PerguntaLiberada,
  extra: { tenant_id: string; request_id: string; publico?: string },
): Promise<Response | null> {
  return fetch(`${base}/v1/${mode}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: redact(pergunta), ...extra }),
    signal: AbortSignal.timeout(mode === 'ask' ? 120_000 : 45_000),
  }).catch((e: unknown) => {
    console.error('biblioteca indisponível', extra.request_id, e instanceof Error ? e.message : String(e))
    relatarErro('clinical-search', 'biblioteca_indisponivel', e)
    return null
  })
}

/** Registro do gateway de IA (ia_gateway_log): só contagens, tipos e hash, nunca o texto. */
async function registrarGateway(
  admin: ReturnType<typeof createClient>,
  d: {
    perfilId: string; bloqueado: boolean; contagem: Contagem; hash: string; residuos: number
    tipos?: Record<string, number>; latenciaMs?: number; erro?: string
  },
) {
  const { error } = await admin.from('ia_gateway_log').insert({
    origem: 'edge:clinical_search',
    perfil_id: d.perfilId,
    bloqueado: d.bloqueado,
    substituicoes: d.contagem,
    residuos: d.residuos,
    hash_entrada: d.hash,
    provedor: 'biblioteca',
    latencia_ms: d.latenciaMs ?? null,
    erro: d.erro ? d.erro.slice(0, 200) : null,
    tipos_bloqueio: d.tipos && Object.keys(d.tipos).length ? d.tipos : null,
  })
  // o registro nunca derruba a busca, mas a falha fica no rastreamento
  if (error) relatarErro('clinical-search', 'ia_gateway_log', error.message)
}
