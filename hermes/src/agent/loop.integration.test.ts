// Teste de integração do caminho de ERRO do loop do agente (LLM indisponível).
// Com LLM_API_KEY vazia/inválida (sem creds reais), a chamada ao DeepSeek
// falha (401) → retry → fallback → erro → o loop DEVE retornar a mensagem de
// instabilidade (nunca silêncio). Teste real, sem mocks.
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

test('loop — LLM sem chave válida retorna mensagem de instabilidade (nunca silêncio)', async () => {
  // Garante que o teste usa uma chave inválida (o .env de dev não tem chave real).
  assert.ok(
    !env.LLM_API_KEY || env.LLM_API_KEY.length < 20,
    'teste assume LLM_API_KEY ausente/inválida no .env de dev'
  )

  const resultado = await executarLoopAgente(
    identidade,
    '5511999990001',
    'Você é o Hermes. Responda curto.',
    [],
    'quais meus plantões da semana?'
  )

  assert.equal(resultado.ok, false, 'deve falhar sem LLM válido')
  assert.match(resultado.texto, /instabilidade/, `esperava mensagem de instabilidade, veio: ${resultado.texto}`)
})

test('loop — com fallback também sem chave, ainda retorna instabilidade', async () => {
  // O .env de dev define LLM_FALLBACK_BASE_URL sem chave → fallback falha → erro final.
  const resultado = await executarLoopAgente(
    identidade,
    '5511999990001',
    'Você é o Hermes.',
    [],
    'oi'
  )
  assert.equal(resultado.ok, false)
  assert.match(resultado.texto, /instabilidade/)
})
