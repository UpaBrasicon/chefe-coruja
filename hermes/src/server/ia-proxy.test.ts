// ─────────────────────────────────────────────────────────────────────────────
// Testes da porta OpenAI-compatível da Corujinha (decisão 4a, 02/10/2026).
//
// O que protegem: texto livre do Telegram só chega ao modelo depois do gateway
// (regex + NER obrigatório). NER fora → recusa em texto, modelo intocado.
// Fastify em memória (inject), modelo/NER/registro trocados por dublês.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

import { registrarProxyIA, MSG_SO_TEXTO } from './ia-proxy.js'
import {
  DesidentificacaoIndisponivel, MSG_CHAMADA_BLOQUEADA, MSG_DESIDENTIFICACAO_INDISPONIVEL,
  type DependenciasGateway,
} from '../gateway/gateway.js'
import type { ChamadaLLM, RespostaLLM } from '../lib/llm.js'

const TOKEN = 't'.repeat(40)
const CPF = '529.982.247-25' // válido pelo algoritmo, gerado para teste

function montar(opts: { token?: string; ner?: DependenciasGateway['ner'] } = {}) {
  const enviados: ChamadaLLM[] = []
  const nerViu: string[] = []
  const app = Fastify({ logger: false })
  registrarProxyIA(app, {
    token: 'token' in opts ? opts.token : TOKEN,
    depsGateway: {
      ner: async (t) => { nerViu.push(t); return opts.ner ? opts.ner(t) : [] },
      completar: async (b): Promise<RespostaLLM> => {
        enviados.push(b)
        return {
          conteudo: 'Recebi o CPF [CPF_1].',
          toolCalls: [],
          provedor: 'primario', modelo: 'deepseek-v4-flash', latenciaMs: 1,
          uso: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }
      },
      registrar: async () => {},
    },
  })
  return { app, enviados, nerViu }
}

const pedido = (texto: string, extra: Record<string, unknown> = {}) => ({
  model: 'qualquer',
  messages: [{ role: 'system', content: 'Você é a Corujinha.' }, { role: 'user', content: texto }],
  ...extra,
})

const auth = { authorization: `Bearer ${TOKEN}` }

test('sem IA_GATEWAY_TOKEN configurado → 503 (falha fechada)', async () => {
  const { app, enviados } = montar({ token: undefined })
  const r = await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: auth, payload: pedido('oi') })
  assert.equal(r.statusCode, 503)
  assert.equal(enviados.length, 0)
})

test('token errado → 401, nada vai ao modelo', async () => {
  const { app, enviados } = montar()
  const r = await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: { authorization: 'Bearer errado' }, payload: pedido('oi') })
  assert.equal(r.statusCode, 401)
  assert.equal(enviados.length, 0)
})

test('Corujinha: texto livre passa pelo gateway — modelo recebe CPF pseudonimizado, resposta volta reidentificada', async () => {
  const { app, enviados, nerViu } = montar()
  const r = await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: auth, payload: pedido(`meu CPF é ${CPF}, quais meus plantões?`) })
  assert.equal(r.statusCode, 200)
  assert.equal(enviados.length, 1)
  assert.doesNotMatch(JSON.stringify(enviados[0]), /529\.982/, 'CPF cru não chega ao modelo')
  assert.ok(nerViu.some((t) => t.includes('[CPF_1]')), 'o NER foi consultado antes do modelo')
  const j = r.json() as { choices: { message: { content: string }; finish_reason: string }[]; usage: { total_tokens: number } }
  assert.equal(j.choices[0]!.message.content, `Recebi o CPF ${CPF}.`)
  assert.equal(j.choices[0]!.finish_reason, 'stop')
  assert.equal(j.usage.total_tokens, 15)
})

test('Corujinha: NER indisponível → resposta de recusa (200) e o modelo NÃO é chamado', async () => {
  const { app, enviados } = montar({ ner: async () => { throw new DesidentificacaoIndisponivel('rede') } })
  const r = await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: auth, payload: pedido('a paciente do leito 3 piorou') })
  assert.equal(r.statusCode, 200, '200 para o Nous entregar a recusa e não acionar provedor de reserva')
  assert.equal(enviados.length, 0)
  const j = r.json() as { choices: { message: { content: string } }[] }
  assert.equal(j.choices[0]!.message.content, MSG_DESIDENTIFICACAO_INDISPONIVEL)
})

test('Corujinha: NER acha nome → bloqueio com aviso, modelo não é chamado', async () => {
  const { app, enviados } = montar({ ner: async (t) => (t.includes('Maria') ? ['Maria Lima'] : []) })
  const r = await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: auth, payload: pedido('a Maria Lima do leito 3') })
  assert.equal(enviados.length, 0)
  assert.equal((r.json() as { choices: { message: { content: string } }[] }).choices[0]!.message.content, MSG_CHAMADA_BLOQUEADA)
})

test('Corujinha: imagem/arquivo não é enviado (só texto passa pela desidentificação)', async () => {
  const { app, enviados } = montar()
  const r = await app.inject({
    method: 'POST', url: '/v1/chat/completions', headers: auth,
    payload: { messages: [{ role: 'user', content: [{ type: 'text', text: 'veja' }, { type: 'image_url', image_url: { url: 'data:...' } }] }] },
  })
  assert.equal(r.statusCode, 200)
  assert.equal(enviados.length, 0)
  assert.equal((r.json() as { choices: { message: { content: string } }[] }).choices[0]!.message.content, MSG_SO_TEXTO)
})

test('stream: true devolve SSE no formato do OpenAI, com [DONE]', async () => {
  const { app, enviados } = montar()
  const r = await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: auth, payload: pedido('oi', { stream: true }) })
  assert.equal(r.statusCode, 200)
  assert.match(String(r.headers['content-type']), /text\/event-stream/)
  assert.equal(enviados.length, 1)
  assert.match(r.body, /"object":"chat\.completion\.chunk"/)
  assert.match(r.body, /data: \[DONE\]\n\n$/)
})

test('pedido malformado → 400 sem ecoar o conteúdo', async () => {
  const { app, enviados } = montar()
  const r = await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: auth, payload: { messages: [{ role: 'hacker', content: `CPF ${CPF}` }] } })
  assert.equal(r.statusCode, 400)
  assert.equal(enviados.length, 0)
  assert.doesNotMatch(r.body, /529/)
})

test('ferramentas do Nous e resultado com nome: nome do resultado sai como pseudônimo', async () => {
  const { app, enviados } = montar()
  const r = await app.inject({
    method: 'POST', url: '/v1/chat/completions', headers: auth,
    payload: {
      messages: [
        { role: 'user', content: 'quem está de plantão?' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'coruja_consultar', arguments: '{"escopo":"escala","comando":"plantao_do_dia"}' } }] },
        { role: 'tool', tool_call_id: 'c1', content: JSON.stringify({ ok: true, dados: [{ profissional: 'Rui Teixeira' }] }) },
      ],
      tools: [{ type: 'function', function: { name: 'coruja_consultar', description: 'x', parameters: { type: 'object', properties: {} } } }],
    },
  })
  assert.equal(r.statusCode, 200)
  assert.equal(enviados.length, 1)
  const enviado = JSON.stringify(enviados[0])
  assert.doesNotMatch(enviado, /Rui Teixeira/)
  assert.match(enviado, /\[PESSOA_1\]/)
  assert.equal(enviados[0]!.tools?.length, 1)
})
