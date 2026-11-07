// node --experimental-strip-types --test src/lib/rascunhoTriagem.test.ts
//
// Achado guardado de 07/10/2026, feito com A em M1 a M5 (RT, 05/11/2026):
// rascunho cifrado na classificação de risco, com validade de 2 h.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const guardado = new Map<string, string>()
const armazenamento = {
  getItem: (k: string) => guardado.get(k) ?? null,
  setItem: (k: string, v: string) => { guardado.set(k, v) },
  removeItem: (k: string) => { guardado.delete(k) },
  key: (i: number) => [...guardado.keys()][i] ?? null,
  get length() { return guardado.size },
}
Object.assign(globalThis, { localStorage: armazenamento, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } })

const { definirChave } = await import('./cofreLocal.ts')
const {
  carregarRascunhoTriagem, chaveRascunhoTriagem, RASCUNHO_TRIAGEM_VAZIO, salvarRascunhoTriagem, temConteudo, VALIDADE_RASCUNHO_TRIAGEM_MS,
} = await import('./rascunhoTriagem.ts')

const chaveB64 = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
const digitado = {
  ...RASCUNHO_TRIAGEM_VAZIO,
  queixa: 'dor torácica', cor: 'laranja' as const, fluxoId: 'f1', disc: 'dor precordial',
  vitais: { 'frequencia-cardiaca': '112' }, aval: { ...RASCUNHO_TRIAGEM_VAZIO.aval, glasgow: '15' },
}

test('M4: um rascunho por atendimento, pessoa e unidade; a reclassificação tem o seu', () => {
  const a = chaveRascunhoTriagem('ep1', false, 'u1', 'p1')
  assert.notEqual(a, chaveRascunhoTriagem('ep1', true, 'u1', 'p1'))
  assert.notEqual(a, chaveRascunhoTriagem('ep1', false, 'u1', 'p2'))
  assert.notEqual(a, chaveRascunhoTriagem('ep2', false, 'u1', 'p1'))
  assert.ok(a.startsWith('cc:rascunho:'), 'o logout apaga pelo prefixo')
})

test('M1: guarda tudo o que foi digitado, inclusive a cor, e só cifrado', () => {
  definirChave(chaveB64())
  const k = chaveRascunhoTriagem('ep1', false, 'u1', 'p1')
  salvarRascunhoTriagem(k, digitado)
  const bruto = guardado.get(k)!
  assert.ok(bruto.startsWith('ccr1:'))
  // depois do prefixo só há base64 (nonce|cifra|tag): nenhum texto digitado nem JSON aberto.
  // Não procurar dígitos soltos ("112") no base64: o cifrado é aleatório e às vezes os contém
  // (derrubou o CI do #477 em 07/11/2026).
  assert.match(bruto.slice('ccr1:'.length), /^[A-Za-z0-9+/]+=*$/)
  assert.ok(!bruto.includes('torácica') && !bruto.includes('"frequencia-cardiaca"'))
  const lido = carregarRascunhoTriagem(k)!
  assert.deepEqual(lido.dados, digitado)
  assert.equal(typeof lido.salvoEm, 'number')
})

test('sem nada digitado não há rascunho', () => {
  // a tela abre com a queixa que veio da recepção: isso sozinho não é rascunho
  assert.equal(temConteudo({ ...RASCUNHO_TRIAGEM_VAZIO, queixa: 'queixa da recepção' }, 'queixa da recepção'), false)
  assert.equal(temConteudo({ ...RASCUNHO_TRIAGEM_VAZIO, queixa: 'queixa da recepção ' }, 'queixa da recepção'), false)
  assert.equal(temConteudo({ ...RASCUNHO_TRIAGEM_VAZIO, queixa: 'outra queixa' }, 'queixa da recepção'), true)
  assert.equal(temConteudo(digitado, 'dor'), true)
})

test('M2: depois de 2 h o rascunho vence e sai do navegador', () => {
  assert.equal(VALIDADE_RASCUNHO_TRIAGEM_MS, 2 * 60 * 60 * 1000)
  definirChave(chaveB64())
  const k = chaveRascunhoTriagem('ep3', false, 'u1', 'p1')
  const agora = Date.now
  try {
    Date.now = () => agora() - VALIDADE_RASCUNHO_TRIAGEM_MS - 1000
    salvarRascunhoTriagem(k, digitado)
  } finally {
    Date.now = agora
  }
  assert.equal(carregarRascunhoTriagem(k), null)
  assert.equal(guardado.has(k), false)
})

test('sem a chave da sessão nada é gravado', () => {
  definirChave(null)
  const k = chaveRascunhoTriagem('ep4', false, 'u1', 'p1')
  salvarRascunhoTriagem(k, digitado)
  assert.equal(guardado.has(k), false)
})

test('a tela usa o rascunho: aviso com a hora, descartar e apagar ao registrar (M3, M5)', () => {
  const tela = readFileSync('src/pages/enfermagem/triagem/Classificar.tsx', 'utf8')
  assert.match(tela, /carregarRascunhoTriagem\(/)
  assert.match(tela, /salvarRascunhoTriagem\(/)
  assert.match(tela, /Confira os sinais vitais antes de registrar/)
  assert.match(tela, /Descartar rascunho/)
  const sucesso = tela.slice(tela.indexOf('onSuccess: () => {'))
  assert.match(sucesso.slice(0, 400), /apagarRascunho\(\)/)
})
