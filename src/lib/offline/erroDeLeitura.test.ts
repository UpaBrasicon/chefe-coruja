// node --experimental-strip-types --test src/lib/offline/erroDeLeitura.test.ts
//
// Achado do teste do RT (05/11/2026, recarga sem conexão, parte 3): com os dados
// restaurados, a lista mostrava "TypeError: Failed to fetch" em vermelho.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { erroDeLeitura } from './erroDeLeitura.ts'

test('sem rede e com dados na tela: nada (a pílula já avisa e mostra a hora)', () => {
  assert.equal(erroDeLeitura(new TypeError('Failed to fetch'), true), null)
  assert.equal(erroDeLeitura({ message: 'TypeError: Failed to fetch', code: '' }, true), null)
})

test('sem rede e sem dados: aviso claro, nunca o erro cru', () => {
  const t = erroDeLeitura(new TypeError('Failed to fetch'), false)!
  assert.match(t, /Sem conexão/)
  assert.doesNotMatch(t, /TypeError|fetch/)
})

test('erro do servidor continua aparecendo como veio', () => {
  assert.equal(erroDeLeitura(new Error('Acesso negado.'), true), 'Acesso negado.')
  assert.equal(erroDeLeitura({ message: 'Acesso negado.' }, false), 'Acesso negado.')
  assert.equal(erroDeLeitura(null, false), null)
})

test('as telas da enfermagem usam o aviso no lugar do erro cru', () => {
  for (const f of ['src/pages/enfermagem/triagem/Fila.tsx', 'src/pages/enfermagem/triagem/Espera.tsx',
    'src/pages/enfermagem/InternacaoEnfermagem.tsx', 'src/pages/enfermagem/ProntoSocorroEnfermagem.tsx']) {
    const fonte = readFileSync(f, 'utf8')
    assert.match(fonte, /erroDeLeitura\(/, f)
    assert.doesNotMatch(fonte, /\{erro\.message\}|\{msgErro\(erro\)\}/, f)
  }
})
