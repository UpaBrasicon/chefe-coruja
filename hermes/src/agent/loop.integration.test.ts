// Testes de integração do loop do agente.
// - Com LLM_API_KEY real: verifica o CAMINHO FELIZ (resposta com conteúdo).
// - Sem chave: verifica o caminho de erro (mensagem de instabilidade).
// Testes reais, sem mocks.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { executarLoopAgente } from './loop.js'
import { env } from '../config/env.js'

const identidade = {
  perfilId: 'da6c5d33-a123-4960-a494-a00c883906a1',
  nome: 'Gestor Teste',
  email: 'gestor@teste.com',
  papel: 'gestor' as const,
  unidadeId: '00000000-0000-0000-0000-000000000101',
  unidadeNome: 'UPA Centro',
  organizacaoId: '00000000-0000-0000-0000-000000000001',
}

const temChave = Boolean(env.LLM_API_KEY && env.LLM_API_KEY.length >= 20)

test('loop — com LLM real responde com conteúdo (caminho feliz)', { skip: !temChave }, async () => {
  const resultado = await executarLoopAgente(
    identidade,
    '5511999990001',
    'Você é o Hermes. Responda em uma frase curta.',
    [],
    'Diga apenas: oi'
  )
  assert.equal(resultado.ok, true, `deve responder com chave real: ${resultado.texto}`)
  assert.ok(resultado.texto.length > 0, 'resposta não pode ser vazia')
})

test('loop — sem chave válida retorna mensagem de instabilidade (nunca silêncio)', { skip: temChave }, async () => {
  const resultado = await executarLoopAgente(
    identidade,
    '5511999990001',
    'Você é o Hermes.',
    [],
    'oi'
  )
  assert.equal(resultado.ok, false)
  assert.match(resultado.texto, /instabilidade/, `esperava instabilidade, veio: ${resultado.texto}`)
})
