// Teste unitário do system prompt (estrutura cache-friendly).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarSystemPrompt } from './system-prompt.js'

const identidade = {
  perfilId: 'da6c5d33-a123-4960-a494-a00c883906a1',
  nome: 'Gestor Teste',
  email: 'gestor@teste.com',
  papel: 'gestor' as const,
  unidadeId: '00000000-0000-0000-0000-000000000101',
  unidadeNome: 'UPA Centro',
  organizacaoId: '00000000-0000-0000-0000-000000000001',
}

test('system prompt — contém identidade, regras e contexto do usuário', () => {
  const p = montarSystemPrompt(identidade, '21/08/2026 09:30')
  assert.match(p, /GAVIÃO/)
  assert.match(p, /Chefe Coruja/)
  assert.match(p, /NUNCA responda pergunta clínica/)
  assert.match(p, /Gestor Teste/)
  assert.match(p, /UPA Centro/)
  assert.match(p, /21\/08\/2026 09:30/)
  assert.match(p, /listar_quarentena/)
  assert.match(p, /Corujinha/)
})

test('system prompt — estrutura cache-friendly: estável primeiro, variável por último', () => {
  const p = montarSystemPrompt(identidade, '21/08/2026 09:30')
  const idxIdentidade = p.indexOf('Você é o GAVIÃO')
  const idxContexto = p.indexOf('CONTEXTO DA SESSÃO')
  const idxUsuario = p.indexOf('Gestor Teste')
  const idxData = p.indexOf('21/08/2026 09:30')

  // Partes estáveis (identidade/regras) vêm ANTES das partes variáveis (dados).
  assert.ok(idxIdentidade !== -1 && idxContexto !== -1)
  assert.ok(idxIdentidade < idxContexto, 'identidade estável antes do contexto variável')
  assert.ok(idxContexto < idxUsuario, 'contexto antes do nome do usuário')
  assert.ok(idxUsuario < idxData, 'nome antes da data/hora (variável no final)')
})

test('system prompt — plantonista sem unidade não quebra', () => {
  const p = montarSystemPrompt(
    { ...identidade, papel: 'plantonista', unidadeId: null, unidadeNome: null },
    '21/08/2026 09:30'
  )
  assert.match(p, /plantonista/)
  assert.doesNotMatch(p, /Unidade: null/)
})
