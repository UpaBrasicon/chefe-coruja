// node --experimental-strip-types --test src/lib/aprovacaoLote.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { chaveVersao, ordemDeAprovacao, resumoDoLote } from './aprovacaoLote.ts'

test('lote: na mesma ferramenta, a versão mais antiga é aprovada primeiro', () => {
  const ordem = ordemDeAprovacao([
    { ferramenta_id: 'intox', versao: '2026-11-11.3' },
    { ferramenta_id: 'glasgow', versao: '2026-11-11.1' },
    { ferramenta_id: 'intox', versao: '2026-10-09.1' },
    { ferramenta_id: 'intox', versao: '2026-11-11.1' },
  ]).map(chaveVersao)
  assert.deepEqual(ordem, ['glasgow@2026-11-11.1', 'intox@2026-10-09.1', 'intox@2026-11-11.1', 'intox@2026-11-11.3'])
})
test('lote: resumo com e sem falha', () => {
  assert.equal(resumoDoLote(1, []), '1 versão aprovada.')
  assert.equal(resumoDoLote(5, []), '5 versões aprovadas.')
  assert.equal(resumoDoLote(3, [{ chave: 'x@1', erro: 'Esta versão já foi decidida (aprovada)' }]),
    '2 versões aprovadas. Uma não foi: x@1 (Esta versão já foi decidida (aprovada)).')
})
