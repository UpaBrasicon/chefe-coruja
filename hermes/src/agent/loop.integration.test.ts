// Testes de integração do loop do agente.
// - Com LLM_API_KEY real e NER configurado: verifica o CAMINHO FELIZ.
// - Sem chave (com NER): verifica o caminho de erro (mensagem de instabilidade).
// - Sem NER configurado (DEID_URL/BIBLIOTECA_API_KEY): o gateway recusa antes
//   do modelo — falha fechada, decisão do RT 02/10/2026.
// Testes reais, sem mocks.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { executarLoopAgente } from './loop.js'
import { env } from '../config/env.js'
import { MSG_DESIDENTIFICACAO_INDISPONIVEL } from '../gateway/gateway.js'

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
const temNER = Boolean(process.env.DEID_URL && process.env.BIBLIOTECA_API_KEY)

test('loop — com LLM real responde com conteúdo (caminho feliz)', { skip: !temChave || !temNER }, async () => {
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

test('loop — sem chave válida retorna mensagem de instabilidade (nunca silêncio)', { skip: temChave || !temNER }, async () => {
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

test('loop — sem NER configurado recusa sem chamar o modelo (falha fechada)', { skip: temNER }, async () => {
  let chamadasModelo = 0
  // registro desligado: o teste não grava linha em ia_gateway_log
  const resultado = await executarLoopAgente(identidade, '5511999990001', 'Você é o Hermes.', [], 'oi', {
    completar: async () => { chamadasModelo++; throw new Error('não deveria chamar') },
    registrar: async () => {},
  })
  assert.equal(chamadasModelo, 0)
  assert.equal(resultado.ok, true)
  assert.equal(resultado.texto, MSG_DESIDENTIFICACAO_INDISPONIVEL)
})
