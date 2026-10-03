// ─────────────────────────────────────────────────────────────────────────────
// Testes do gateway de IA — NER obrigatório, falha fechada (RT 02/10/2026).
//
// O serviço /v1/deid é simulado por um servidor HTTP local de verdade (porta
// efêmera): fora do ar, 500, resposta malformada, modelo desligado, timeout.
// O modelo e o registro são trocados por contadores — nenhum teste aqui sai
// para a internet nem grava em ia_gateway_log.
// ─────────────────────────────────────────────────────────────────────────────
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import {
  chamarIA, ChamadaBloqueada, DesidentificacaoIndisponivel, nomesNER, pedacosNER, temNomeAlemDoPseudonimo,
  type ConfigNER, type ContextoGateway, type DependenciasGateway,
} from './gateway.js'
import { criarCofre } from './desidentificacao.js'
import type { ChamadaLLM, RespostaLLM } from '../lib/llm.js'
import { executarLoopAgente } from '../agent/loop.js'

// Modo do NER simulado, trocado por teste.
type ModoNER = 'ok' | 'nome' | 'erro500' | 'malformado' | 'inativo' | 'lento'
let modo: ModoNER = 'ok'
const textosRecebidosPeloNER: string[] = []
let servidor: Server
let urlNER = ''
const CHAVE = 'chave-de-teste'

before(async () => {
  servidor = createServer((req, res) => {
    let corpo = ''
    req.on('data', (c) => { corpo += c })
    req.on('end', () => {
      if (req.headers.authorization !== `Bearer ${CHAVE}`) { res.writeHead(401).end(); return }
      textosRecebidosPeloNER.push((JSON.parse(corpo) as { texto: string }).texto)
      const json = (o: unknown) => { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(o)) }
      switch (modo) {
        case 'ok': return json({ texto: 'x', found: [], ner_ativo: true })
        case 'nome': return json({ texto: 'x', found: ['Maria Lima'], ner_ativo: true })
        case 'erro500': res.writeHead(500).end('erro'); return
        case 'malformado': res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"found": "nao-e-lista"'); return
        case 'inativo': return json({ texto: 'x', found: [], ner_ativo: false })
        case 'lento': setTimeout(() => json({ texto: 'x', found: [], ner_ativo: true }), 1500); return
      }
    })
  })
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok))
  urlNER = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/v1/deid`
})

after(async () => {
  servidor.closeAllConnections()
  await new Promise<void>((ok) => servidor.close(() => ok()))
})

// CPF válido pelo algoritmo, gerado para teste — não pertence a ninguém.
const CPF = '529.982.247-25'

function ctx(): ContextoGateway {
  return { cofre: criarCofre(), conhecidos: [{ valor: 'Ana Souza', categoria: 'PESSOA' }], origem: 'teste', perfilId: null }
}

const corpo = (texto: string): ChamadaLLM => ({
  mensagens: [{ role: 'system', content: 'Você é a Corujinha.' }, { role: 'user', content: texto }],
})

/** Dependências de teste: conta chamadas ao modelo e guarda o que iria para o registro. */
function dublês(cfg: ConfigNER) {
  const enviadosAoModelo: ChamadaLLM[] = []
  const registros: unknown[] = []
  const deps: Partial<DependenciasGateway> = {
    ner: (t) => nomesNER(t, cfg),
    completar: async (b): Promise<RespostaLLM> => {
      enviadosAoModelo.push(b)
      // O modelo devolve o pseudônimo; o gateway reidentifica.
      return { conteudo: 'Anotado para [PESSOA_1], CPF [CPF_1].', toolCalls: [], provedor: 'primario', modelo: 'teste', latenciaMs: 1 }
    },
    registrar: async (_c, d) => { registros.push(d) },
  }
  return { deps, enviadosAoModelo, registros }
}

const cfgOk = (): ConfigNER => ({ url: urlNER, chave: CHAVE, timeoutMs: 1000 })

async function esperaIndisponivel(cfg: ConfigNER, motivo: string) {
  const d = dublês(cfg)
  const texto = `Aqui é Ana Souza, CPF ${CPF}`
  await assert.rejects(chamarIA(corpo(texto), ctx(), d.deps), (err: unknown) => {
    assert.ok(err instanceof DesidentificacaoIndisponivel, `esperava DesidentificacaoIndisponivel, veio ${String(err)}`)
    assert.equal(err.motivo, motivo)
    return true
  })
  assert.equal(d.enviadosAoModelo.length, 0, 'NER indisponível: nada pode ir ao modelo')
  assert.equal(d.registros.length, 1, 'a recusa fica registrada')
  const reg = JSON.stringify(d.registros[0])
  assert.match(reg, /"bloqueado":true/)
  assert.doesNotMatch(reg, /Ana|Souza|529/, 'o registro não leva o texto')
}

test('NER sem configuração (DEID_URL/chave ausentes) → recusa, modelo não é chamado', async () => {
  await esperaIndisponivel({ timeoutMs: 1000 }, 'sem_configuracao')
  await esperaIndisponivel({ url: urlNER, timeoutMs: 1000 }, 'sem_configuracao')
})

test('NER fora do ar (conexão recusada) → recusa, modelo não é chamado', async () => {
  // porta 9 (discard) em 127.0.0.1: nada ouvindo
  await esperaIndisponivel({ url: 'http://127.0.0.1:9/v1/deid', chave: CHAVE, timeoutMs: 1000 }, 'rede')
})

test('NER responde 500 → recusa', async () => {
  modo = 'erro500'
  await esperaIndisponivel(cfgOk(), 'http')
})

test('NER com chave errada (401) → recusa', async () => {
  modo = 'ok'
  await esperaIndisponivel({ url: urlNER, chave: 'outra', timeoutMs: 1000 }, 'http')
})

test('NER com resposta malformada → recusa', async () => {
  modo = 'malformado'
  await esperaIndisponivel(cfgOk(), 'resposta_invalida')
})

test('NER sem o modelo spaCy (ner_ativo:false) → recusa: regex sozinha não basta', async () => {
  modo = 'inativo'
  await esperaIndisponivel(cfgOk(), 'ner_inativo')
})

test('NER lento (timeout) → recusa', async () => {
  modo = 'lento'
  await esperaIndisponivel({ url: urlNER, chave: CHAVE, timeoutMs: 200 }, 'timeout')
})

test('caminho normal: NER ok → modelo recebe texto desidentificado e a resposta volta reidentificada', async () => {
  modo = 'ok'
  textosRecebidosPeloNER.length = 0
  const d = dublês(cfgOk())
  const r = await chamarIA(corpo(`Aqui é Ana Souza, CPF ${CPF}. Quais meus plantões?`), ctx(), d.deps)
  assert.equal(d.enviadosAoModelo.length, 1)
  const enviado = JSON.stringify(d.enviadosAoModelo[0])
  assert.doesNotMatch(enviado, /Ana Souza|529\.982/, 'nome conhecido e CPF não saem')
  assert.match(enviado, /\[PESSOA_1\]/)
  assert.match(enviado, /\[CPF_1\]/)
  assert.equal(r.conteudo, `Anotado para Ana Souza, CPF ${CPF}.`)
  // o NER viu o texto já pseudonimizado (regex antes, NER depois)
  assert.ok(textosRecebidosPeloNER.some((t) => t.includes('[PESSOA_1]')))
  assert.ok(!textosRecebidosPeloNER.some((t) => t.includes('Ana Souza')))
  assert.match(JSON.stringify(d.registros[0]), /"bloqueado":false/)
})

test('NER acha nome de pessoa → bloqueia (ChamadaBloqueada), modelo não é chamado', async () => {
  modo = 'nome'
  const d = dublês(cfgOk())
  await assert.rejects(chamarIA(corpo('a maria lima do leito 3 piorou'), ctx(), d.deps), ChamadaBloqueada)
  assert.equal(d.enviadosAoModelo.length, 0)
  assert.equal(d.registros.length, 1)
  const reg = d.registros[0] as { bloqueado: boolean; tiposBloqueio?: Record<string, number> }
  assert.equal(reg.bloqueado, true)
  // o dublê do NER acha nome nos dois textos (sistema e usuário): um achado por texto
  assert.deepEqual(reg.tiposBloqueio, { 'nome próprio (NER)': 2 }, 'registro diz o tipo do bloqueio')
  assert.doesNotMatch(JSON.stringify(reg), /maria|lima|trecho|\[nome\]/i, 'registro nunca leva o trecho')
})

test('resíduo de regex bloqueia: registro leva a contagem por tipo, nunca o trecho', async () => {
  modo = 'ok'
  const d = dublês(cfgOk())
  // CPF inválido (não pseudonimizado) + data completa + e-mail sobram como resíduo
  const texto = 'doc 12345678900, 11122233344, nasceu 12/03/1980, mail fulano.x@exemplo.com'
  await assert.rejects(chamarIA(corpo(texto), ctx(), d.deps), ChamadaBloqueada)
  assert.equal(d.enviadosAoModelo.length, 0)
  assert.equal(d.registros.length, 1)
  const reg = d.registros[0] as { bloqueado: boolean; residuos: number; tiposBloqueio?: Record<string, number> }
  assert.equal(reg.bloqueado, true)
  assert.ok(reg.tiposBloqueio, 'registro traz tiposBloqueio')
  const soma = Object.values(reg.tiposBloqueio).reduce((a, b) => a + b, 0)
  assert.equal(soma, reg.residuos, 'a soma por tipo bate com residuos')
  for (const k of Object.keys(reg.tiposBloqueio)) {
    assert.ok(['sequência de 11 dígitos', 'sequência de 15 dígitos', 'data completa', 'e-mail', 'nome próprio (NER)'].includes(k), `tipo inesperado: ${k}`)
  }
  assert.doesNotMatch(JSON.stringify(reg), /12345678900|11122233344|1980|fulano|exemplo|trecho/i, 'registro nunca leva o trecho')
})

test('caminho normal não grava tiposBloqueio', async () => {
  modo = 'ok'
  const d = dublês(cfgOk())
  await chamarIA(corpo('quais meus plantões?'), ctx(), d.deps)
  assert.equal((d.registros[0] as { tiposBloqueio?: unknown }).tiposBloqueio, undefined)
})

test('nomesNER filtra nomes do sistema devolvidos pelo serviço', async () => {
  // servidor simulado devolvendo só nome do sistema
  const s2 = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ found: ['Corujinha', 'Chefe Coruja'], ner_ativo: true }))
  })
  await new Promise<void>((ok) => s2.listen(0, '127.0.0.1', ok))
  try {
    const url = `http://127.0.0.1:${(s2.address() as AddressInfo).port}/v1/deid`
    assert.deepEqual(await nomesNER('Sou a Corujinha, do Chefe Coruja.', { url, chave: CHAVE, timeoutMs: 1000 }), [])
  } finally {
    s2.closeAllConnections()
    await new Promise<void>((ok) => s2.close(() => ok()))
  }
})

test('texto longo é quebrado em pedaços que o /v1/deid aceita (≤ 8000), cobrindo tudo', () => {
  const palavra = 'plantão '
  const longo = palavra.repeat(3000) // 24 mil caracteres
  const pedacos = pedacosNER(longo)
  assert.ok(pedacos.length >= 4)
  for (const p of pedacos) assert.ok(p.length <= 8000, `pedaço com ${p.length}`)
  assert.ok(pedacos[0]!.startsWith('plantão'))
  assert.ok(longo.endsWith(pedacos.at(-1)!))
  assert.deepEqual(pedacosNER('curto'), ['curto'])
})

test('loop do WhatsApp: NER indisponível → recusa ao usuário, modelo não é chamado', async () => {
  let chamadas = 0
  const identidade = {
    perfilId: '00000000-0000-0000-0000-0000000000aa', nome: 'Gestor Teste', email: null, papel: 'gestor' as const,
    unidadeId: null, unidadeNome: null, organizacaoId: null, vinculos: [], superAdmin: false,
  }
  const r = await executarLoopAgente(identidade, '5511999990001', 'Você é o Gavião.', [], 'oi', {
    ner: (t) => nomesNER(t, { timeoutMs: 1000 }),
    completar: async () => { chamadas++; throw new Error('não deveria chamar') },
    registrar: async () => {},
  })
  assert.equal(chamadas, 0)
  assert.equal(r.ok, true)
  assert.match(r.texto, /Desidentificação indisponível; tente mais tarde/)
})

test('nerIgnoraSistema: nome no prompt de sistema passa; o mesmo nome na mensagem do usuário bloqueia', async () => {
  const d = dublês(cfgOk())
  const deps = { ...d.deps, ner: async (t: string) => (/Ricardo/.test(t) ? ['Ricardo'] : []) }
  const chamada = (sistema: string, usuario: string): ChamadaLLM => ({
    mensagens: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
  })
  const c = { ...ctx(), nerIgnoraSistema: true }
  await chamarIA(chamada('You are talking to Ricardo.', 'oi'), c, deps)
  assert.equal(d.enviadosAoModelo.length, 1, 'nome só no sistema: vai ao modelo')
  await assert.rejects(chamarIA(chamada('Você é a Corujinha.', 'o Ricardo piorou'), c, deps), ChamadaBloqueada)
  await assert.rejects(chamarIA(chamada('You are talking to Ricardo.', 'oi'), ctx(), deps), ChamadaBloqueada, 'sem a opção, o sistema também passa pelo NER')
})

test('NER marcando o próprio pseudônimo não bloqueia; nome junto do pseudônimo bloqueia', () => {
  assert.equal(temNomeAlemDoPseudonimo('[PESSOA_1]'), false)
  assert.equal(temNomeAlemDoPseudonimo('PACIENTE_12'), false)
  assert.equal(temNomeAlemDoPseudonimo('[PESSOA_1] e [DATA_2]'), false)
  assert.equal(temNomeAlemDoPseudonimo('[PESSOA_1] Silva'), true)
  assert.equal(temNomeAlemDoPseudonimo('Maria Lima'), true)
  assert.equal(temNomeAlemDoPseudonimo('Quais'), false, 'palavra comum em início de frase não é nome')
  assert.equal(temNomeAlemDoPseudonimo('Vou'), false)
  assert.equal(temNomeAlemDoPseudonimo('Quais Maria'), true, 'com nome junto continua contando')
  assert.equal(temNomeAlemDoPseudonimo('AAAA-MM-DD'), false, 'máscara de data não é nome')
  assert.equal(temNomeAlemDoPseudonimo('DD/MM/AAAA'), false)
  assert.equal(temNomeAlemDoPseudonimo('MARIA LIMA'), true, 'nome em maiúsculas continua nome')
  assert.equal(temNomeAlemDoPseudonimo('\\"escopo\\"}'), false, 'pedaço de JSON minúsculo não é nome')
  assert.equal(temNomeAlemDoPseudonimo('Maria Lima"'), true, 'nome colado em aspas continua nome')
  assert.equal(temNomeAlemDoPseudonimo('maria lima'), true, 'sem pontuação de JSON, minúscula continua contando')
  assert.equal(temNomeAlemDoPseudonimo('Ligar o Telegram'), false, 'pedido de vínculo não é nome (produção 03/10)')
  assert.equal(temNomeAlemDoPseudonimo('Ligar o Telegram da Maria'), true, 'com nome junto continua contando')
})
