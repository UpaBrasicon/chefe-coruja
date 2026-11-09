import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { criarFilaAteCarregar } from './filaAteCarregar.ts'

// Item 21 do kit de desempenho (docs/desempenho/AUDITORIA.md): o Sentry
// (cerca de 31 KB em gzip) ia no pacote inicial. Agora desce depois que a
// página carrega; o que for reportado antes espera numa fila curta.

test('antes de carregar, guarda; ao carregar, envia o que esperava, na ordem', () => {
  const enviados: string[] = []
  const f = criarFilaAteCarregar<string, string>({ maximo: 10 }, (m, e) => enviados.push(`${m}:${e}`))
  f.enviar('a')
  f.enviar('b')
  assert.deepEqual(enviados, [])
  f.pronto('S')
  assert.deepEqual(enviados, ['S:a', 'S:b'])
})

test('depois de carregar, envia na hora', () => {
  const enviados: string[] = []
  const f = criarFilaAteCarregar<string, string>({ maximo: 10 }, (m, e) => enviados.push(`${m}:${e}`))
  f.pronto('S')
  f.enviar('c')
  assert.deepEqual(enviados, ['S:c'])
})

test('a fila tem teto: além dele, descarta (erro em laço não enche a memória)', () => {
  const enviados: string[] = []
  const f = criarFilaAteCarregar<string, number>({ maximo: 3 }, (_m, e) => enviados.push(String(e)))
  for (let i = 0; i < 10; i++) f.enviar(i)
  f.pronto('S')
  assert.deepEqual(enviados, ['0', '1', '2'])
})

test('falha ao enviar um item não impede os outros', () => {
  const enviados: string[] = []
  const f = criarFilaAteCarregar<string, string>({ maximo: 10 }, (_m, e) => {
    if (e === 'ruim') throw new Error('x')
    enviados.push(e)
  })
  f.enviar('a')
  f.enviar('ruim')
  f.enviar('b')
  f.pronto('S')
  assert.deepEqual(enviados, ['a', 'b'])
})

test('o sentry.ts não importa a biblioteca no início (só tipos e import dinâmico)', () => {
  const fonte = readFileSync('src/lib/sentry.ts', 'utf8')
  assert.doesNotMatch(fonte, /^import (?!type)[^\n]*from '@sentry\/react'/m)
  assert.match(fonte, /import\('@\/lib\/sentryCarga'\)/)
  // o módulo de carga nomeia o que usa (import dinâmico da biblioteca inteira
  // levaria tudo: 154 KB em gzip contra cerca de 30 KB)
  assert.match(readFileSync('src/lib/sentryCarga.ts', 'utf8'), /export \{ captureMessage, init, withScope \} from '@sentry\/react'/)
})
