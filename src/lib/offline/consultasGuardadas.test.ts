// node --experimental-strip-types --test src/lib/offline/consultasGuardadas.test.ts
//
// Recarga sem conexão, parte 3 (A em N1 a N5, RT em 05/11/2026): o que as telas
// da enfermagem já mostraram fica cifrado na aba e volta numa recarga sem rede,
// com a hora em que foi lido.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const sessao = new Map<string, string>()
Object.assign(globalThis, {
  sessionStorage: {
    getItem: (k: string) => sessao.get(k) ?? null,
    setItem: (k: string, v: string) => { sessao.set(k, v) },
    removeItem: (k: string) => { sessao.delete(k) },
  },
})

const { definirChave } = await import('../cofreLocal.ts')
const { apagarConsultas, CHAVE_CONSULTAS, consultaPermitida, guardarConsultas, lerConsultas, TETO_BYTES } = await import('./consultasGuardadas.ts')

const chaveB64 = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
const estado = {
  mutations: [],
  queries: [{ queryKey: ['enfermagem-leitos', 'u1'], queryHash: 'h', state: { data: [{ paciente: 'Paciente Teste Lima', leito: '3' }], dataUpdatedAt: 1000, status: 'success' } }],
}

test('só as consultas das telas de enfermagem entram', () => {
  for (const k of ['enfermagem-leitos', 'triagem-fila', 'cuidados-enfermagem', 'fila-checagem', 'painel-observacao', 'setores-na-escala']) {
    assert.equal(consultaPermitida([k, 'x']), true, k)
  }
  for (const k of ['vinculos', 'chat-mensagens', 'painel-gestor', 'contas', 'auditoria']) assert.equal(consultaPermitida([k]), false, k)
  assert.equal(consultaPermitida([]), false)
  assert.equal(consultaPermitida([42]), false)
})

test('cifrado na aba, sem nome de paciente legível; sem chave não grava', () => {
  definirChave(null)
  guardarConsultas(estado)
  assert.equal(sessao.has(CHAVE_CONSULTAS), false)
  definirChave(chaveB64())
  guardarConsultas(estado)
  const bruto = sessao.get(CHAVE_CONSULTAS)!
  assert.ok(bruto.startsWith('ccr1:'))
  assert.ok(!bruto.includes('Paciente Teste'))
  const lido = lerConsultas()!
  assert.deepEqual(lido.estado, estado)
  assert.equal(typeof lido.guardadoEm, 'number')
})

test('grande demais não grava (o armazenamento da aba tem limite)', () => {
  definirChave(chaveB64())
  apagarConsultas()
  const enorme = { mutations: [], queries: [{ queryKey: ['enfermagem-leitos'], state: { data: 'x'.repeat(TETO_BYTES + 10) } }] }
  guardarConsultas(enorme)
  assert.equal(sessao.has(CHAVE_CONSULTAS), false)
})

test('sair apaga; chave de outra sessão não lê', () => {
  definirChave(chaveB64())
  guardarConsultas(estado)
  definirChave(chaveB64())
  assert.equal(lerConsultas(), null)
  apagarConsultas()
  assert.equal(sessao.has(CHAVE_CONSULTAS), false)
})

test('a casca restaura só ao cair no modo sem rede, e mostra a hora na pílula', () => {
  const auth = readFileSync('src/contexts/AuthContext.tsx', 'utf8')
  assert.match(auth, /restaurarConsultas\(queryClient\)/)
  assert.match(auth, /apagarConsultas\(\)/)
  assert.match(readFileSync('src/App.tsx', 'utf8'), /ligarConsultasSemConexao\(queryClient\)/)
  assert.match(readFileSync('src/components/AppShell.tsx', 'utf8'), /dados das \$\{/)
})
