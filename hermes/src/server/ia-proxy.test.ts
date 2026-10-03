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

import { registrarProxyIA, MSG_SO_TEXTO, semNotasDoNous } from './ia-proxy.js'
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

test('nome do usuário no prompt de sistema sai como pseudônimo em tudo e volta na resposta; o histórico não trava', async () => {
  const { app, enviados } = montar({ ner: async (t) => (t.includes('Ricardo') ? ['Ricardo'] : []) })
  const payload = {
    model: 'qualquer',
    messages: [
      { role: 'system', content: 'You are talking to Ricardo on Telegram.' },
      { role: 'user', content: 'quantos setores?' },
      { role: 'assistant', content: 'São 8 setores, Ricardo.' },
      { role: 'user', content: 'e leitos?' },
    ],
  }
  const r = await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: auth, payload })
  assert.equal(enviados.length, 1, 'não bloqueou')
  assert.doesNotMatch(JSON.stringify(enviados[0]!.mensagens), /Ricardo/, 'o modelo não vê o nome, nem no sistema nem no histórico')
  assert.equal(r.statusCode, 200)
})

test('recusa do gateway no histórico não vai ao modelo nem trava a volta seguinte', async () => {
  const { app, enviados } = montar({ ner: async (t) => (t.includes('Reescreva') ? ['Reescreva'] : []) })
  const payload = {
    model: 'qualquer',
    messages: [
      { role: 'system', content: 'Você é a Corujinha.' },
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: MSG_CHAMADA_BLOQUEADA },
      { role: 'user', content: 'quantos setores?' },
    ],
  }
  await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: auth, payload })
  assert.equal(enviados.length, 1, 'não bloqueou')
  assert.doesNotMatch(JSON.stringify(enviados[0]!.mensagens), /Reescreva/)
})

test('notas [System note: …] do Nous saem da mensagem do usuário antes do gateway', async () => {
  const intro = 'oi' + String.fromCharCode(10, 10) + "[System note: This is the user's very first message ever. Briefly introduce yourself.]"
  assert.equal(semNotasDoNous(intro), 'oi')
  assert.equal(semNotasDoNous('[System note: a [b] c] resumo da unidade'), 'resumo da unidade')
  assert.equal(semNotasDoNous('oi [System note: Maria Silva sem fechar'), 'oi', 'sem colchete de fechamento: corta até o fim')
  assert.equal(semNotasDoNous('sem nota'), 'sem nota')
  const { app, enviados } = montar({ ner: async (t) => (/Briefly|decline/.test(t) ? ['Briefly'] : []) })
  const payload = { model: 'qualquer', messages: [
    { role: 'system', content: 'Você é a Coruja Gestora.' },
    { role: 'user', content: 'me dá o resumo [System note: OFFER to build a profile, explain they can decline.]' },
  ] }
  await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: auth, payload })
  assert.equal(enviados.length, 1, 'não bloqueou')
  assert.doesNotMatch(JSON.stringify(enviados[0]!.mensagens), /System note|decline/)
})

test('NER na Corujinha: digitado sempre; ferramenta só no texto livre; fala da IA e biblioteca fora', async () => {
  const ner = async (t: string) => ['Manole', 'Vou', 'Gaviao', 'Maria Lima'].filter((n) => t.includes(n))
  const historico = (resultado: string, ferramenta = 'coruja_consultar', ultima = 'ok') => ({
    model: 'qualquer',
    messages: [
      { role: 'system', content: 'Você é a Corujinha.' },
      { role: 'user', content: 'pergunta' },
      { role: 'assistant', content: 'Vou consultar.', tool_calls: [{ id: 'c1', type: 'function', function: { name: ferramenta, arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: resultado },
      { role: 'user', content: ultima },
    ],
  })
  const enviar = async (payload: object) => {
    const { app, enviados } = montar({ ner })
    const r = await app.inject({ method: 'POST', url: '/v1/chat/completions', headers: auth, payload })
    return { enviados, texto: (r.json() as { choices: { message: { content: string } }[] }).choices[0]!.message.content }
  }
  // título de incidente e editora de livro não bloqueiam; "Vou" na fala da IA também não
  assert.equal((await enviar(historico(JSON.stringify({ dados: [{ titulo: '[Gaviao] conteúdo' }] })))).enviados.length, 1)
  assert.equal((await enviar(historico(JSON.stringify({ trechos: [{ editor: 'Manole' }] }), 'biblioteca_clinica_buscar'))).enviados.length, 1)
  // nome no texto livre da ferramenta bloqueia
  const livre = await enviar(historico(JSON.stringify({ dados: [{ trecho: 'a Maria Lima piorou' }] })))
  assert.equal(livre.enviados.length, 0)
  assert.equal(livre.texto, MSG_CHAMADA_BLOQUEADA)
  // nome digitado pela pessoa bloqueia
  assert.equal((await enviar(historico('{}', 'coruja_consultar', 'e a Maria Lima?'))).enviados.length, 0)
  // resultado que não é JSON: texto inteiro passa pelo NER
  assert.equal((await enviar(historico('Maria Lima'))).enviados.length, 0)
})
