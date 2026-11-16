// Pedido 8, J3: regras do formulário "Agendar demonstração".
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { origemPermitida } from '../_shared/cors.ts'
import { corpoEmail, enderecoDaRede, jsonAscii, lerPedido, ORIGENS_DO_FORMULARIO, resumoDoEndereco, siteDoPedido } from './regras.ts'

const valido = { nome: 'Ana Souza', email: 'ana@exemplo.com', telefone: '(11) 98765-4321', unidade: 'UPA Centro, coordenação', mensagem: 'Quero ver a escala.', token: 'tk' }

test('pedido válido passa, com o token do Turnstile', () => {
  const r = lerPedido(valido)
  assert.equal(r.tipo, 'ok')
  if (r.tipo === 'ok') {
    assert.equal(r.token, 'tk')
    assert.equal(r.pedido.nome, 'Ana Souza')
  }
})

test('campo-isca preenchido é robô', () => {
  assert.deepEqual(lerPedido({ ...valido, website: 'http://spam' }), { tipo: 'isca' })
})

test('nome curto, e-mail inválido e telefone curto são recusados', () => {
  assert.deepEqual(lerPedido({ ...valido, nome: 'A' }), { tipo: 'invalido', campo: 'nome' })
  assert.deepEqual(lerPedido({ ...valido, email: 'ana@' }), { tipo: 'invalido', campo: 'email' })
  assert.deepEqual(lerPedido({ ...valido, telefone: '1234-5678' }), { tipo: 'invalido', campo: 'telefone' })
})

test('corpo vazio ou não objeto é inválido, sem quebrar', () => {
  assert.equal(lerPedido(null).tipo, 'invalido')
  assert.equal(lerPedido('texto').tipo, 'invalido')
})

test('campos longos são cortados', () => {
  const r = lerPedido({ ...valido, mensagem: 'x'.repeat(5000), nome: 'N'.repeat(300) })
  assert.equal(r.tipo, 'ok')
  if (r.tipo === 'ok') {
    assert.equal(r.pedido.mensagem.length, 4000)
    assert.equal(r.pedido.nome.length, 120)
  }
})

test('corpo do e-mail em texto puro, com "não informado" quando falta a unidade', () => {
  const r = lerPedido({ ...valido, unidade: '', mensagem: '<b>oi</b>' })
  assert.equal(r.tipo, 'ok')
  if (r.tipo === 'ok') {
    const corpo = corpoEmail(r.pedido)
    assert.match(corpo, /Unidade e cargo: \(não informado\)/)
    assert.match(corpo, /<b>oi<\/b>/) // vai como texto, nunca como HTML
  }
})

test('JSON só com ASCII', () => {
  const j = jsonAscii({ assunto: 'Pedido de demonstração' })
  assert.ok([...j].every((c) => c.charCodeAt(0) < 128))
  assert.deepEqual(JSON.parse(j), { assunto: 'Pedido de demonstração' })
})

test('endereço de rede vem do primeiro x-forwarded-for', () => {
  // S6 (B1): o primeiro item é do cliente; vale o último, que o gateway acrescenta
  assert.equal(enderecoDaRede(new Headers({ 'x-forwarded-for': '10.0.0.1, 203.0.113.7' })), '203.0.113.7')
  assert.equal(enderecoDaRede(new Headers({ 'x-forwarded-for': '10.0.0.1, 203.0.113.7', 'cf-connecting-ip': '198.51.100.2' })), '198.51.100.2')
  assert.equal(enderecoDaRede(new Headers({ 'cf-connecting-ip': '198.51.100.2' })), '198.51.100.2')
  assert.equal(enderecoDaRede(new Headers()), 'desconhecido')
})

test('resumo do endereço é sha256 hex, muda com o sal e não contém o endereço', async () => {
  const a = await resumoDoEndereco('203.0.113.7', 'sal-1')
  const b = await resumoDoEndereco('203.0.113.7', 'sal-2')
  assert.match(a, /^[0-9a-f]{64}$/)
  assert.notEqual(a, b)
  assert.ok(!a.includes('203'))
})

test('S10 (H3): CORS aceita planos só nesta função, sem abrir para qualquer origem', () => {
  const g = globalThis as { Deno?: unknown }
  const antes = g.Deno
  g.Deno = { env: { get: (n: string) => (n === 'APP_ORIGIN' ? 'https://www.chefecoruja.com.br' : undefined) } }
  try {
    const req = (origem: string) => new Request('https://x.supabase.co/functions/v1/pedir-demonstracao', { headers: { Origin: origem } })
    const planos = 'https://planos.chefecoruja.com.br'
    assert.equal(origemPermitida(req(planos), ORIGENS_DO_FORMULARIO), planos)
    assert.equal(origemPermitida(req('https://chefecoruja.com.br'), ORIGENS_DO_FORMULARIO), 'https://chefecoruja.com.br')
    // origem estranha recebe a primeira da lista, nunca a dela nem '*'
    assert.equal(origemPermitida(req('https://golpe.example'), ORIGENS_DO_FORMULARIO), 'https://www.chefecoruja.com.br')
    // as outras funções (sem extras) continuam sem aceitar planos
    assert.equal(origemPermitida(req(planos)), 'https://www.chefecoruja.com.br')
  } finally {
    g.Deno = antes
  }
})

test('S10 (H3): o e-mail diz de qual site veio o pedido', () => {
  assert.equal(siteDoPedido('https://planos.chefecoruja.com.br'), 'planos.chefecoruja.com.br')
  assert.equal(siteDoPedido('https://www.chefecoruja.com.br'), 'www.chefecoruja.com.br')
  assert.equal(siteDoPedido('https://golpe.example'), 'www.chefecoruja.com.br')
  assert.equal(siteDoPedido(null), 'www.chefecoruja.com.br')
  const r = lerPedido(valido)
  if (r.tipo === 'ok') assert.match(corpoEmail(r.pedido, 'planos.chefecoruja.com.br'), /\(planos\.chefecoruja\.com\.br\)/)
})
