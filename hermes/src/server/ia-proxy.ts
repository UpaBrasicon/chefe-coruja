// ─────────────────────────────────────────────────────────────────────────────
// HERMES — server/ia-proxy.ts
// Porta OpenAI-compatível do gateway de IA para a CORUJINHA (Nous, Telegram).
// Decisão 4a do RT (02/10/2026): texto livre da Corujinha só chega ao modelo
// passando pelo gateway que desidentifica (ADR 0006).
//
// Antes: o agente do Nous chamava o DeepSeek direto, com a chave do provedor no
// próprio container — o texto do Telegram saía sem regex, sem NER e sem
// registro. Agora o provedor configurado no Nous é ESTA rota
// (http://hermes-app:3000/v1, rede interna deploy_default) e a chave do
// DeepSeek fica só no hermes-app:
//
//   Nous → POST /v1/chat/completions → chamarIA (regex + NER obrigatório +
//          resíduo) → DeepSeek → reidentifica → Nous → Telegram
//
// Recusa (NER fora, resíduo, falha do modelo, conteúdo não-texto) volta como
// resposta 200 do "assistente" com o texto da recusa: assim o Nous entrega a
// mensagem à pessoa e NÃO aciona um provedor de reserva que contornaria o
// gateway. Erro 4xx/5xx fica só para token errado, rota sem configuração e
// pedido malformado.
//
// Não é pública: o Caddy só expõe /webhook e /health.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'

import {
  chamarIA, ChamadaBloqueada, DesidentificacaoIndisponivel, nomesEmResultado, nomesNER,
  MSG_CHAMADA_BLOQUEADA, MSG_DESIDENTIFICACAO_INDISPONIVEL,
  type ContextoGateway, type DependenciasGateway,
} from '../gateway/gateway.js'
import { criarCofre, desidentificar, type Conhecido } from '../gateway/desidentificacao.js'
import type { ChamadaLLM, MensagemLLM, RespostaLLM, ToolDefLLM } from '../lib/llm.js'
import { logger } from '../logger.js'

export const MSG_SO_TEXTO =
  'Por aqui eu só consigo processar texto. Imagem, áudio ou arquivo não foram enviados ao assistente.'
export const MSG_INSTABILIDADE_IA = 'Estou com instabilidade agora. Tente de novo em alguns minutos.'

const MAX_TOKENS_PADRAO = 2048
const MAX_TOKENS_TETO = 8192

// ── Formato do pedido (o que o cliente OpenAI do Nous manda) ─────────────────

const parteConteudo = z.object({ type: z.string(), text: z.string().optional() }).passthrough()

const toolCall = z.object({
  id: z.string(),
  type: z.literal('function').default('function'),
  function: z.object({ name: z.string(), arguments: z.string().default('') }),
})

const mensagem = z.object({
  role: z.enum(['system', 'developer', 'user', 'assistant', 'tool']),
  content: z.union([z.string(), z.array(parteConteudo), z.null()]).optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(toolCall).optional(),
}).passthrough()

const ferramenta = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string().default(''),
    parameters: z.record(z.unknown()).default({ type: 'object', properties: {} }),
  }),
})

const pedido = z.object({
  messages: z.array(mensagem).min(1),
  tools: z.array(ferramenta).optional(),
  tool_choice: z.union([z.enum(['auto', 'none', 'required']), z.object({}).passthrough()]).optional(),
  max_tokens: z.number().int().positive().optional(),
  max_completion_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
}).passthrough()

type Pedido = z.infer<typeof pedido>

const RECUSAS = new Set([MSG_SO_TEXTO, MSG_INSTABILIDADE_IA, MSG_CHAMADA_BLOQUEADA, MSG_DESIDENTIFICACAO_INDISPONIVEL])

class SoTexto extends Error {}

/** Converte o pedido OpenAI no formato do gateway. Conteúdo não-texto lança SoTexto (falha fechada). */
export function paraChamada(p: Pedido): ChamadaLLM {
  const mensagens: MensagemLLM[] = p.messages.map((m) => {
    let content = ''
    if (typeof m.content === 'string') content = m.content
    else if (Array.isArray(m.content)) {
      // imagem/áudio/arquivo não passam pela desidentificação de texto
      if (m.content.some((parte) => parte.type !== 'text')) throw new SoTexto()
      content = m.content.map((parte) => parte.text ?? '').join('\n')
    }
    return {
      role: m.role === 'developer' ? 'system' : m.role,
      content,
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}),
    }
  })
  const pedidoTokens = p.max_completion_tokens ?? p.max_tokens ?? MAX_TOKENS_PADRAO
  return {
    mensagens,
    ...(p.tools?.length ? { tools: p.tools as ToolDefLLM[] } : {}),
    ...(p.tool_choice ? { toolChoice: typeof p.tool_choice === 'string' ? p.tool_choice : 'required' } : {}),
    maxTokens: Math.min(pedidoTokens, MAX_TOKENS_TETO),
  }
}

/** Nomes que as ferramentas do Nous devolveram (resultado em JSON) viram identificadores conhecidos. */
function conhecidosDasFerramentas(mensagens: MensagemLLM[]) {
  const achados: ReturnType<typeof nomesEmResultado> = []
  for (const m of mensagens) {
    if (m.role !== 'tool' || !m.content) continue
    try {
      nomesEmResultado(JSON.parse(m.content), achados)
    } catch {
      // resultado em texto puro: fica com regex + NER
    }
  }
  return achados
}

/** Caminhos de chave (só os nomes das chaves) cujo valor contém o texto. */
function caminhosCom(dados: unknown, alvo: string, prefixo = '', saida: string[] = []): string[] {
  if (typeof dados === 'string') {
    if (dados.includes(alvo)) saida.push(prefixo || '(raiz)')
  } else if (Array.isArray(dados)) {
    dados.forEach((d) => caminhosCom(d, alvo, `${prefixo}[]`, saida))
  } else if (dados && typeof dados === 'object') {
    for (const [k, v] of Object.entries(dados)) caminhosCom(v, alvo, prefixo ? `${prefixo}.${k}` : k, saida)
  }
  return saida
}

/**
 * Diagnóstico de bloqueio por NER: em que papel de mensagem e, no resultado de
 * ferramenta, em que chave do JSON caiu o "nome". Nunca registra o valor.
 */
async function ondeNER(mensagens: MensagemLLM[], ctx: ContextoGateway) {
  const onde: { papel: string; tamanho: number; forma: string; caminhos: string[] }[] = []
  for (const m of mensagens) {
    if (m.role === 'system' || !m.content?.trim()) continue
    const limpo = desidentificar(m.content, criarCofre(), ctx.conhecidos).texto
    for (const nome of await nomesNER(limpo).catch(() => [] as string[])) {
      let caminhos: string[] = []
      if (m.role === 'tool') {
        try { caminhos = [...new Set(caminhosCom(JSON.parse(m.content), nome))] } catch { caminhos = ['(texto)'] }
      }
      // forma: letra vira A/a e dígito vira 9; pseudônimo fica como está (não é dado)
      const forma = nome.split(/(\[[A-Z]+_\d+\])/).map((p, i) => (i % 2 ? p : p.replace(/\p{Lu}/gu, 'A').replace(/\p{Ll}/gu, 'a').replace(/\d/g, '9'))).join('')
      onde.push({ papel: m.role, tamanho: nome.length, forma, caminhos })
    }
  }
  return onde
}

/**
 * Nomes de pessoa no prompt de sistema do Nous (o nome do usuário do Telegram
 * entra ali). Viram identificadores conhecidos: saem como pseudônimo em TODAS
 * as mensagens, inclusive no próprio sistema, e voltam só na resposta. Sem
 * isso o modelo via o nome e o repetia, e a volta seguinte travava no NER do
 * histórico. Cache pelo hash do sistema, que quase não muda entre as voltas.
 */
const cacheNomesSistema = new Map<string, string[]>()
async function nomesDoSistema(mensagens: MensagemLLM[], ner: (t: string) => Promise<string[]>): Promise<Conhecido[]> {
  const texto = mensagens.filter((m) => m.role === 'system').map((m) => m.content ?? '').join('\n')
  if (!texto.trim()) return []
  const chave = createHash('sha256').update(texto).digest('hex')
  let nomes = cacheNomesSistema.get(chave)
  if (!nomes) {
    nomes = [...new Set((await ner(texto)).map((n) => n.trim()).filter((n) => n.length >= 3))]
    if (cacheNomesSistema.size >= 20) cacheNomesSistema.clear()
    cacheNomesSistema.set(chave, nomes)
  }
  return nomes.map((valor) => ({ valor, categoria: 'PESSOA' as const }))
}

function tokenConfere(recebido: string | undefined, esperado: string | undefined): boolean {
  if (!recebido || !esperado) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ── Resposta no formato OpenAI (com e sem stream) ────────────────────────────

type Saida = Pick<RespostaLLM, 'conteudo' | 'toolCalls' | 'uso'> & { modelo: string }

function responder(reply: FastifyReply, stream: boolean, s: Saida) {
  const id = `chatcmpl-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const finish = s.toolCalls.length ? 'tool_calls' : 'stop'
  const usage = s.uso ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  if (!stream) {
    return reply.code(200).send({
      id, object: 'chat.completion', created, model: s.modelo,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: s.conteudo, ...(s.toolCalls.length ? { tool_calls: s.toolCalls } : {}) },
        finish_reason: finish,
      }],
      usage,
    })
  }

  // Stream "de uma vez": o gateway precisa da resposta inteira para
  // reidentificar; entregamos em poucos pedaços no formato SSE do OpenAI.
  const pedaco = (delta: Record<string, unknown>, finish_reason: string | null, extra: Record<string, unknown> = {}) =>
    `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model: s.modelo, choices: [{ index: 0, delta, finish_reason }], ...extra })}\n\n`
  const corpo =
    pedaco({ role: 'assistant', content: s.conteudo }, null) +
    (s.toolCalls.length ? pedaco({ tool_calls: s.toolCalls.map((tc, index) => ({ index, ...tc })) }, null) : '') +
    pedaco({}, finish, { usage }) +
    'data: [DONE]\n\n'
  return reply.code(200).header('Content-Type', 'text/event-stream').header('Cache-Control', 'no-cache').send(corpo)
}

// ── Rota ─────────────────────────────────────────────────────────────────────

export type OpcoesProxyIA = {
  /** Token que o Nous manda como chave do provedor. Sem ele a rota responde 503 (falha fechada). */
  token?: string
  /** Só para teste: troca modelo/NER/registro do gateway. */
  depsGateway?: Partial<DependenciasGateway>
}

export function registrarProxyIA(app: FastifyInstance, opcoes: OpcoesProxyIA) {
  app.post('/v1/chat/completions', { bodyLimit: 4 * 1024 * 1024 }, async (req, reply) => {
    if (!opcoes.token) {
      return reply.code(503).send({ error: { message: 'gateway de IA sem IA_GATEWAY_TOKEN', type: 'server_error' } })
    }
    const auth = req.headers.authorization
    const recebido = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined
    if (!tokenConfere(recebido, opcoes.token)) {
      logger.warn({ ip: req.ip }, '[ia-proxy] token inválido → 401')
      return reply.code(401).send({ error: { message: 'unauthorized', type: 'invalid_request_error' } })
    }

    const p = pedido.safeParse(req.body)
    if (!p.success) {
      // sem ecoar o corpo: só os caminhos que falharam
      return reply.code(400).send({
        error: { message: `pedido inválido: ${p.error.issues.map((i) => i.path.join('.')).join(', ')}`, type: 'invalid_request_error' },
      })
    }
    const stream = p.data.stream === true

    let chamada: ChamadaLLM
    try {
      chamada = paraChamada(p.data)
      // As recusas do próprio gateway voltam no histórico como fala do assistente.
      // Não são conversa: vão ao modelo como marcador neutro (senão o NER marca
      // palavras delas como nome e uma recusa puxa a seguinte).
      chamada.mensagens = chamada.mensagens.map((m) =>
        m.role === 'assistant' && RECUSAS.has((m.content ?? '').trim()) ? { ...m, content: '(mensagem anterior não enviada)' } : m)
    } catch (err) {
      if (err instanceof SoTexto) return responder(reply, stream, { conteudo: MSG_SO_TEXTO, toolCalls: [], modelo: 'gateway' })
      throw err
    }

    const ctx: ContextoGateway = {
      cofre: criarCofre(),
      conhecidos: conhecidosDasFerramentas(chamada.mensagens),
      origem: 'corujinha:telegram',
      perfilId: null,
      // O sistema é o prompt fixo do Nous (instruções e ferramentas, em inglês,
      // que o NER em português marca como nome). Memória do Nous desligada no
      // config.yaml, para nada vindo de conversa entrar no sistema.
      nerIgnoraSistema: true,
    }

    try {
      // NER no sistema também falha fechado: sem ele, nada vai ao modelo.
      ctx.conhecidos.push(...(await nomesDoSistema(chamada.mensagens, opcoes.depsGateway?.ner ?? ((t) => nomesNER(t)))))
      const r = await chamarIA(chamada, ctx, opcoes.depsGateway)
      return responder(reply, stream, { conteudo: r.conteudo, toolCalls: r.toolCalls, uso: r.uso, modelo: r.modelo })
    } catch (err) {
      if (err instanceof DesidentificacaoIndisponivel) {
        return responder(reply, stream, { conteudo: MSG_DESIDENTIFICACAO_INDISPONIVEL, toolCalls: [], modelo: 'gateway' })
      }
      if (err instanceof ChamadaBloqueada) {
        // Só o tipo e a quantidade (nunca o trecho): para ajustar a limpeza sem expor dado.
        const tipos: Record<string, number> = {}
        for (const r of err.residuos) tipos[r.tipo] = (tipos[r.tipo] ?? 0) + 1
        const onde = tipos['nome próprio (NER)'] ? await ondeNER(chamada.mensagens, ctx) : []
        logger.warn({ residuos: err.residuos.length, tipos, onde }, '[ia-proxy] gateway bloqueou a chamada')
        return responder(reply, stream, { conteudo: MSG_CHAMADA_BLOQUEADA, toolCalls: [], modelo: 'gateway' })
      }
      logger.error({ err: (err as Error).message }, '[ia-proxy] falha no modelo')
      return responder(reply, stream, { conteudo: MSG_INSTABILIDADE_IA, toolCalls: [], modelo: 'gateway' })
    }
  })
}
