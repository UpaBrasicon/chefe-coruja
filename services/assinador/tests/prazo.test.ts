// Pedido 18 (F7): prazo nas chamadas ao provedor do certificado e ao Supabase.
// O assinador está desligado na produção, então a API travada é simulada aqui:
// um fetch falso que nunca responde e um servidor que aceita e não responde.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

import {
  assinarHash, certificados, PROVEDOR_SEM_RESPOSTA_ASSINATURA, PROVEDOR_SEM_RESPOSTA_SESSAO, trocarCodigo,
  type Fetch, type Provedor,
} from '../src/docicp17.ts'
import { ErroAssinador } from '../src/erros.ts'
import { comNovaTentativa, comPrazo, PRAZO_PROVEDOR_MS, PRAZO_SUPABASE_MS } from '../src/prazo.ts'
import { CONFERENCIA_SEM_RESPOSTA, SUPABASE_SEM_RESPOSTA, supabaseDoMedico } from '../src/real.ts'

const PRAZO = 80

/** fetch que nunca responde; conta as chamadas e guarda o método e o sinal de cada uma */
function travado() {
  const chamadas: { url: string; metodo: string; signal?: AbortSignal | null }[] = []
  const f: Fetch = (url, init) => {
    chamadas.push({ url, metodo: init?.method ?? 'GET', signal: init?.signal })
    return new Promise<Response>(() => {}) // nem olha o sinal: o prazo tem de valer assim mesmo
  }
  return { f, chamadas }
}

/** fetch que responde em sequência; a última resposta se repete */
function respostas(...lista: Array<() => Response>) {
  const chamadas: string[] = []
  const f: Fetch = async (url, init) => {
    chamadas.push(`${init?.method ?? 'GET'} ${new URL(url).pathname}`)
    return lista[Math.min(chamadas.length - 1, lista.length - 1)]()
  }
  return { f, chamadas }
}
const json = (j: unknown, status = 200) => () => new Response(JSON.stringify(j), { status, headers: { 'Content-Type': 'application/json' } })

/** o laço de eventos fica vivo enquanto a promessa espera (o timer do AbortSignal.timeout não segura o Node) */
async function esperando<T>(p: Promise<T>): Promise<T> {
  const vivo = setInterval(() => {}, 1000)
  try {
    return await p
  } finally {
    clearInterval(vivo)
  }
}

const erro504 = (mensagem: string) => (e: unknown) => e instanceof ErroAssinador && e.status === 504 && e.message === mensagem

const provedor = (base = 'http://provedor.teste'): Provedor => ({
  id: 'vidaas', nome: 'Teste', base, clientId: 'cli', clientSecret: 'segredo', redirectUri: 'https://assina.exemplo/retorno', hashEm: 'base64',
  caminhos: { autorizar: '/v0/oauth/authorize', token: '/v0/oauth/token', certificados: '/v0/oauth/certificate-discovery', assinar: '/v0/oauth/signature' },
  prazoMs: PRAZO,
})

test('prazos começam folgados: 15 s no provedor e 10 s no Supabase', () => {
  assert.equal(PRAZO_PROVEDOR_MS, 15_000)
  assert.equal(PRAZO_SUPABASE_MS, 10_000)
})

test('comPrazo: operação travada rejeita com 504 no prazo, mesmo ignorando o sinal', async () => {
  const inicio = Date.now()
  let sinal: AbortSignal | undefined
  await esperando(assert.rejects(comPrazo(PRAZO, 'não respondeu', (s) => { sinal = s; return new Promise(() => {}) }), erro504('não respondeu')))
  assert.ok(Date.now() - inicio < 2000, 'não esperou muito além do prazo')
  assert.equal(sinal?.aborted, true, 'o sinal do fetch foi abortado')
  assert.equal(await comPrazo(PRAZO, 'x', async () => 'ok'), 'ok')
  await assert.rejects(comPrazo(PRAZO, 'x', async () => { throw new Error('outro erro') }), /outro erro/, 'erro que não é prazo passa como veio')
})

test('comNovaTentativa: repete só falha passageira e para no limite', async () => {
  let n = 0
  assert.equal(await comNovaTentativa(async () => { if (++n === 1) throw new ErroAssinador(504, 'x', true); return 'ok' }, { esperaMs: 1 }), 'ok')
  assert.equal(n, 2)
  n = 0
  await assert.rejects(comNovaTentativa(async () => { n++; throw new ErroAssinador(400, 'definitivo') }, { esperaMs: 1 }), /definitivo/)
  assert.equal(n, 1, 'erro definitivo não repete')
  n = 0
  await assert.rejects(comNovaTentativa(async () => { n++; throw new TypeError('fetch failed') }, { esperaMs: 1 }), /fetch failed/)
  assert.equal(n, 2, 'falha de rede repete uma vez só')
})

test('provedor travado na troca do código: 504 com texto claro e sem nova tentativa (o código vale uma vez)', async () => {
  const { f, chamadas } = travado()
  await esperando(assert.rejects(trocarCodigo(provedor(), 'codigo', 'verifier', f), erro504(PROVEDOR_SEM_RESPOSTA_SESSAO)))
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].signal?.aborted, true)
})

test('provedor travado na assinatura: 504 com texto claro e nunca assina de novo', async () => {
  const { f, chamadas } = travado()
  await esperando(assert.rejects(assinarHash(provedor(), 'token', 'alias', new Uint8Array(32), 'Atestado nº 1', f), erro504(PROVEDOR_SEM_RESPOSTA_ASSINATURA)))
  assert.equal(chamadas.length, 1, 'assinar duas vezes não é inofensivo')
  assert.equal(chamadas[0].metodo, 'POST')
})

test('provedor travado na lista de certificados (consulta): tenta de novo uma vez e então 504', async () => {
  const { f, chamadas } = travado()
  await esperando(assert.rejects(certificados(provedor(), 'token', f), erro504(PROVEDOR_SEM_RESPOSTA_SESSAO)))
  assert.equal(chamadas.length, 2)
  assert.ok(chamadas.every((c) => c.metodo === 'GET'))
})

test('lista de certificados: 503 passageiro e depois resposta boa', async () => {
  const { f, chamadas } = respostas(json({}, 503), json({ certificates: [{ alias: 'cert-medico', certificate: Buffer.from('DER').toString('base64') }] }))
  const [c] = await certificados(provedor(), 'token', f)
  assert.equal(c.alias, 'cert-medico')
  assert.equal(chamadas.length, 2)
  const erro = respostas(json({}, 401))
  await assert.rejects(certificados(provedor(), 'token', erro.f), /certificados: HTTP 401/)
  assert.equal(erro.chamadas.length, 1, '401 não é passageiro')
})

test('servidor de verdade que aceita a conexão e não responde: o fetch é cortado no prazo', async () => {
  const srv = createServer(() => {}) // nunca responde
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()))
  try {
    const p = provedor(`http://127.0.0.1:${(srv.address() as { port: number }).port}`)
    await assert.rejects(assinarHash(p, 'token', 'alias', new Uint8Array(32), 'x'), erro504(PROVEDOR_SEM_RESPOSTA_ASSINATURA))
  } finally {
    srv.closeAllConnections()
    srv.close()
  }
})

test('Supabase travado: consulta (GET) tenta de novo uma vez; POST nunca repete', async () => {
  const t = travado()
  const supa = supabaseDoMedico('http://supa.teste', 'chave', t.f, { prazoMs: PRAZO, esperaMs: 1 })
  await esperando(assert.rejects(supa.quemE('jwt'), erro504(SUPABASE_SEM_RESPOSTA)))
  assert.deepEqual(t.chamadas.map((c) => c.metodo), ['GET', 'GET'])
  assert.ok(t.chamadas.every((c) => c.signal?.aborted))

  for (const chamar of [() => supa.folhaHtml('jwt', 'doc'), () => supa.fimDoPlantao('jwt')]) {
    t.chamadas.length = 0
    await esperando(assert.rejects(chamar(), erro504(SUPABASE_SEM_RESPOSTA)))
    assert.deepEqual(t.chamadas.map((c) => c.metodo), ['POST'], 'a folha registra a impressão: sem nova tentativa')
  }
  for (const chamar of [() => supa.conferir('X'), () => supa.pdfAssinado('X')]) {
    t.chamadas.length = 0
    await esperando(assert.rejects(chamar(), erro504(CONFERENCIA_SEM_RESPOSTA)))
    assert.equal(t.chamadas.length, 1)
  }
})

test('Supabase: 503 passageiro na consulta repete; 401 vira sessão inválida sem repetir', async () => {
  const ok = respostas(json({}, 503), json({ id: 'p1' }), json([{ id: 'p1', nome_completo: 'Médica', cpf: '123.456.789-09', registro_numero: '1', registro_uf: 'SP' }]))
  const m = await supabaseDoMedico('http://supa.teste', 'chave', ok.f, { prazoMs: PRAZO, esperaMs: 1 }).quemE('jwt')
  assert.equal(m.cpf, '12345678909')
  assert.deepEqual(ok.chamadas, ['GET /auth/v1/user', 'GET /auth/v1/user', 'GET /rest/v1/perfis'])

  const negado = respostas(json({}, 401))
  await assert.rejects(supabaseDoMedico('http://supa.teste', 'chave', negado.f, { esperaMs: 1 }).quemE('jwt'), (e: unknown) => e instanceof ErroAssinador && e.status === 401)
  assert.equal(negado.chamadas.length, 1)

  const caiu = respostas(json({}, 503))
  await assert.rejects(supabaseDoMedico('http://supa.teste', 'chave', caiu.f, { esperaMs: 1 }).fimDoPlantao('jwt'), (e: unknown) => e instanceof ErroAssinador && e.status === 502)
  assert.equal(caiu.chamadas.length, 1, 'POST não repete nem com 503')
})

/** trecho de `f(` até o parêntese que fecha a chamada */
function chamadas(fonte: string): string[] {
  const out: string[] = []
  for (const m of fonte.matchAll(/\bf\(/g)) {
    let nivel = 0
    for (let i = m.index! + 1; i < fonte.length; i++) {
      if (fonte[i] === '(') nivel++
      else if (fonte[i] === ')' && --nivel === 0) { out.push(fonte.slice(m.index!, i + 1)); break }
    }
  }
  return out
}

test('guarda: toda chamada de fora do assinador leva o sinal do prazo', () => {
  for (const arquivo of ['docicp17.ts', 'real.ts']) {
    const fonte = readFileSync(new URL(`../src/${arquivo}`, import.meta.url), 'utf8')
    const lista = chamadas(fonte)
    assert.ok(lista.length >= 2, `${arquivo}: achou as chamadas`)
    for (const c of lista) assert.match(c, /\bsignal\b/, `${arquivo}: chamada sem prazo: ${c.slice(0, 80)}`)
  }
  const prazo = readFileSync(new URL('../src/prazo.ts', import.meta.url), 'utf8')
  assert.match(prazo, /AbortSignal\.timeout\(ms\)/)
})
