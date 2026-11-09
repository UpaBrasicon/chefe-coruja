import { test } from 'node:test'
import assert from 'node:assert/strict'

import { normalizarRota } from './rotaSemIdentificador.ts'

// Item 30 do kit de desempenho (decisão do RT em 09/11/2026): as métricas de
// usuários reais vão ao Sentry com a rota como marcador. A rota não pode levar
// identificador nenhum: paciente, atendimento, regulação, token de link público.

test('UUID vira :id', () => {
  assert.equal(normalizarRota('/prontuarios/3f2b8c1e-9d4a-4c7b-8e2f-1a2b3c4d5e6f'), '/prontuarios/:id')
  assert.equal(normalizarRota('/plantao/internacao/3F2B8C1E-9D4A-4C7B-8E2F-1A2B3C4D5E6F/leito'), '/plantao/internacao/:id/leito')
})

test('número (paciente, atendimento, regulação) vira :id', () => {
  assert.equal(normalizarRota('/regulacao/12345'), '/regulacao/:id')
  assert.equal(normalizarRota('/atendimento/987/prescricao'), '/atendimento/:id/prescricao')
})

test('qualquer trecho com dígito, maiúscula ou símbolo vira :id (CPF, CNS, e-mail, nome codificado)', () => {
  assert.equal(normalizarRota('/busca/123.456.789-00'), '/busca/:id')
  assert.equal(normalizarRota('/busca/898001234567893'), '/busca/:id')
  assert.equal(normalizarRota('/x/maria%20silva'), '/x/:id')
  assert.equal(normalizarRota('/x/Maria'), '/x/:id')
  assert.equal(normalizarRota('/x/a@b.com'), '/x/:id')
  assert.equal(normalizarRota('/x/ab12cd'), '/x/:id')
})

test('links públicos com token: tudo depois do prefixo vira :token', () => {
  assert.equal(normalizarRota('/r/receita/abcdefghijklmnop'), '/r/:token/:token')
  assert.equal(normalizarRota('/painel/k9X2mQ7vR4tL'), '/painel/:token')
  assert.equal(normalizarRota('/alta/semnumeroaqui'), '/alta/:token')
})

test('consulta (?) e âncora (#) saem inteiras', () => {
  assert.equal(normalizarRota('/agenda?paciente=3f2b8c1e-9d4a-4c7b-8e2f-1a2b3c4d5e6f&nome=Joao'), '/agenda')
  assert.equal(normalizarRota('/login#access_token=xyz&type=recovery'), '/login')
})

test('rotas do app sem identificador ficam como estão', () => {
  assert.equal(normalizarRota('/'), '/')
  assert.equal(normalizarRota('/plantonista'), '/plantonista')
  assert.equal(normalizarRota('/plantao/check-in'), '/plantao/check-in')
  assert.equal(normalizarRota('/plantonista/calculadoras/escore_news'), '/plantonista/calculadoras/escore_news')
  assert.equal(normalizarRota('/plantao/observacao/'), '/plantao/observacao')
})

test('profundidade limitada e trecho longo demais cortado', () => {
  assert.equal(normalizarRota('/a/b/c/d/e/f/g/h'), '/a/b/c/d/e/f/…')
  assert.equal(normalizarRota('/' + 'a'.repeat(60)), '/:id')
})
