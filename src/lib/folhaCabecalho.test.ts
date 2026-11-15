// node --experimental-strip-types --test src/lib/folhaCabecalho.test.ts
// S4 da trilha de segurança (D1): o cabeçalho da folha escapa o que recebe.
// O título do modelo do termo entrava cru e virava HTML na janela de impressão.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { montarFolha, type ContextoFolha } from './folhas.ts'

const ctx: ContextoFolha = {
  unidade: { nome: 'UPA Teste' }, paciente: { nome: 'Paciente Teste', nascimento: '1980-01-01' },
  autor: { nome: 'Médico Teste', registro: 'CRM 9' },
  emissao: { modo: 'emitido', numero: '2026-000124', versao: 1, protocolo: 'IMP-ABCDEF0124', em: '2026-11-15T15:10:00Z', codigo: 'ABC124' },
}

test('título do modelo do termo sai como texto no cabeçalho', () => {
  const html = montarFolha('termo_consentimento', {
    termo: { procedimento: 'Sutura', modelo: { titulo: '<b id="inj">X</b><style>.alergia{display:none}</style>' } },
  }, ctx)
  assert.doesNotMatch(html, /<b id="inj">/)
  assert.doesNotMatch(html, /<style>\.alergia\{display:none\}<\/style>/)
  assert.match(html, /&lt;b id=&quot;inj&quot;&gt;X&lt;\/b&gt;|&lt;b id="inj"&gt;X&lt;\/b&gt;/)
})

test('texto comum do cabeçalho não é escapado duas vezes', () => {
  const html = montarFolha('termo_consentimento', { termo: { procedimento: 'Sutura', modelo: { titulo: 'Sutura & curativo' } } }, ctx)
  assert.match(html, /Sutura &amp; curativo/)
  assert.doesNotMatch(html, /&amp;amp;/)
})
