import { test } from 'node:test'
import assert from 'node:assert/strict'

import { PROJETOS, conferirAlvo } from './supabase-alvo.mjs'

const H = PROJETOS.homolog
const P = PROJETOS.producao

test('push em homologação com homologação ligada passa', () => {
  assert.equal(conferirAlvo({ acao: 'push', alvo: 'homolog', ligado: H }).ok, true)
})

test('push em homologação com PRODUÇÃO ligada é recusado', () => {
  const r = conferirAlvo({ acao: 'push', alvo: 'homolog', ligado: P })
  assert.equal(r.ok, false)
  assert.match(r.motivo, /producao/)
})

test('reset em homologação com homologação ligada passa', () => {
  assert.equal(conferirAlvo({ acao: 'reset', alvo: 'homolog', ligado: H }).ok, true)
})

test('reset em produção é sempre recusado, mesmo confirmado', () => {
  const r = conferirAlvo({ acao: 'reset', alvo: 'producao', ligado: P, confirmaProducao: true })
  assert.equal(r.ok, false)
  assert.match(r.motivo, /proibido/)
})

test('push em produção sem confirmação é recusado', () => {
  const r = conferirAlvo({ acao: 'push', alvo: 'producao', ligado: P })
  assert.equal(r.ok, false)
  assert.match(r.motivo, /confirmo-producao/)
})

test('push em produção confirmado e com produção ligada passa', () => {
  assert.equal(conferirAlvo({ acao: 'push', alvo: 'producao', ligado: P, confirmaProducao: true }).ok, true)
})

test('nenhum projeto ligado é recusado', () => {
  assert.equal(conferirAlvo({ acao: 'push', alvo: 'homolog', ligado: '' }).ok, false)
})

test('alvo e ação desconhecidos são recusados', () => {
  assert.equal(conferirAlvo({ acao: 'push', alvo: 'staging', ligado: H }).ok, false)
  assert.equal(conferirAlvo({ acao: 'drop', alvo: 'homolog', ligado: H }).ok, false)
})

test('versão das Edge Functions: commit, data e marca de modificado', async () => {
  const { conteudoVersao } = await import('./supabase-alvo.mjs')
  assert.match(conteudoVersao('abc1234', '2026-10-07T01:00Z', false), /export const VERSAO = 'abc1234@2026-10-07T01:00Z'/)
  assert.match(conteudoVersao('abc1234', '2026-10-07T01:00Z', true), /'abc1234-modificado@/)
})
