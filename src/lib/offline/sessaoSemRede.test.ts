// node --experimental-strip-types --test src/lib/offline/sessaoSemRede.test.ts
//
// Recarga sem conexão, parte 1 (A em N1 a N5, RT em 05/11/2026;
// docs/porta/RECARGA-SEM-CONEXAO-DIAGNOSTICO.md): três defeitos de hoje.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { apagarTokensDeSessao, ehFalhaDeRede } from './sessaoSemRede.ts'

function area(inicial: Record<string, string>) {
  const m = new Map(Object.entries(inicial))
  return {
    m,
    get length() { return m.size },
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k) },
  }
}

test('D1: sair apaga o token sb-* dos dois armazenamentos, e só ele', () => {
  const local = area({ 'sb-x-auth-token': 't', 'cc-manter': '1', 'cc:rascunho:a': 'ccr1:z' })
  const sessao = area({ 'sb-x-auth-token': 't2', 'cc-chave-rascunho': 'k' })
  apagarTokensDeSessao([local, sessao])
  assert.deepEqual([...local.m.keys()], ['cc-manter', 'cc:rascunho:a'])
  assert.deepEqual([...sessao.m.keys()], ['cc-chave-rascunho'])
  apagarTokensDeSessao([undefined, null]) // armazenamento bloqueado não quebra
})

test('D3: renovação que não alcançou o servidor é falha de rede, não sessão encerrada', () => {
  assert.equal(ehFalhaDeRede({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }), true)
  assert.equal(ehFalhaDeRede(new TypeError('Failed to fetch')), true)
  assert.equal(ehFalhaDeRede({ name: 'AuthApiError', message: 'Invalid Refresh Token', status: 400 }), false)
  assert.equal(ehFalhaDeRede(null), false)
})

test('D1: o AuthContext apaga o token mesmo se o pedido de saída falhar', () => {
  const ctx = readFileSync('src/contexts/AuthContext.tsx', 'utf8')
  assert.equal((ctx.match(/finally \{ apagarTokenLocal\(\) \}/g) ?? []).length, 2, 'encerrarLocal e signOut')
})

test('D3: sem sessão por falha de rede, rascunhos e chave ficam', () => {
  const ctx = readFileSync('src/contexts/AuthContext.tsx', 'utf8')
  const bloco = ctx.slice(ctx.indexOf('supabase.auth.getSession().then('), ctx.indexOf('onAuthStateChange'))
  assert.match(bloco, /ehFalhaDeRede\(error\)/)
  assert.ok(bloco.indexOf('ehFalhaDeRede(error)') < bloco.indexOf('limparTodosRascunhos()'))
})

test('D2: sem resposta do segundo fator, a chave volta da cópia desta aba', () => {
  const gancho = readFileSync('src/hooks/useChaveRascunho.ts', 'utf8')
  assert.match(gancho, /semResposta/)
  assert.match(gancho, /if \(!ativo\) \{ if \(semResposta && !temChave\(\)\) chaveDaAba\(\); return \}/)
  const casca = readFileSync('src/components/AppShell.tsx', 'utf8')
  assert.match(casca, /useChaveRascunho\(.*, segundoFator\.isError\)/)
})
