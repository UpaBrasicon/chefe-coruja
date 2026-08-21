// Teste de integração da sessão (hermes_sessions) contra o Supabase real.
// Pula se SVC_KEY não estiver setada.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { supabase } from '../lib/supabase.js'
import { carregarSessao, salvarSessao, type MensagemSessao } from './sessao.js'

const SVC = process.env.SVC_KEY
const pular = !SVC

// Usuário de teste (gestor da org de teste) — existe no remoto.
const USER_TESTE = 'da6c5d33-a123-4960-a494-a00c883906a1'

test.after(async () => {
  // Limpa sessões de teste criadas por esta suíte.
  await supabase.from('hermes_sessions').delete().like('phone', 'teste-sessao-%')
})

test('salvar + carregar sessão — retorna as mensagens salvas', { skip: pular }, async () => {
  const waId = `teste-sessao-${Date.now()}`
  const msgs: MensagemSessao[] = [
    { role: 'user', content: 'quais meus plantões?', ts: new Date().toISOString() },
    { role: 'assistant', content: 'Você tem 3 plantões esta semana.', ts: new Date().toISOString() },
  ]

  await salvarSessao(USER_TESTE, waId, msgs)
  const carregadas = await carregarSessao(USER_TESTE, waId)

  assert.equal(carregadas.length, 2)
  assert.equal(carregadas[0]?.content, 'quais meus plantões?')
  assert.equal(carregadas[1]?.content, 'Você tem 3 plantões esta semana.')
})

test('janela de contexto — mantém apenas as últimas 20 mensagens', { skip: pular }, async () => {
  const waId = `teste-sessao-${Date.now()}`
  const msgs: MensagemSessao[] = Array.from({ length: 25 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `mensagem ${i + 1}`,
    ts: new Date().toISOString(),
  }))

  await salvarSessao(USER_TESTE, waId, msgs)
  const carregadas = await carregarSessao(USER_TESTE, waId)

  assert.equal(carregadas.length, 20, 'janela deve ter no máximo 20')
  assert.equal(carregadas[0]?.content, 'mensagem 6', 'começa da 6ª (as 5 primeiras caíram)')
  assert.equal(carregadas[19]?.content, 'mensagem 25')
})

test('expiração — sessão com updated_at antigo (2h+) volta vazia', { skip: pular }, async () => {
  const waId = `teste-sessao-${Date.now()}`
  const msgs: MensagemSessao[] = [
    { role: 'user', content: 'oi', ts: new Date().toISOString() },
  ]

  await salvarSessao(USER_TESTE, waId, msgs)

  // Envelhece a sessão em 3h para simular inatividade.
  const antigo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('hermes_sessions')
    .update({ updated_at: antigo })
    .eq('phone', waId)
  assert.equal(error, null, `falha ao envelhecer sessão: ${error?.message}`)

  const carregadas = await carregarSessao(USER_TESTE, waId)
  assert.deepEqual(carregadas, [], 'sessão expirada deve retornar lista vazia')
})

test('upsert idempotente — salvar 2x não cria sessões duplicadas', { skip: pular }, async () => {
  const waId = `teste-sessao-${Date.now()}`
  await salvarSessao(USER_TESTE, waId, [
    { role: 'user', content: 'primeira', ts: new Date().toISOString() },
  ])
  await salvarSessao(USER_TESTE, waId, [
    { role: 'user', content: 'primeira', ts: new Date().toISOString() },
    { role: 'assistant', content: 'segunda', ts: new Date().toISOString() },
  ])

  const { data: linhas, error } = await supabase
    .from('hermes_sessions')
    .select('id')
    .eq('user_id', USER_TESTE)
    .eq('phone', waId)
  assert.equal(error, null, `falha ao contar sessões: ${error?.message}`)
  assert.equal(linhas?.length, 1, 'deve existir apenas 1 sessão por (user_id, phone)')

  const carregadas = await carregarSessao(USER_TESTE, waId)
  assert.equal(carregadas.length, 2, 'a janela deve ter as 2 mensagens (upsert atualizou)')
})
