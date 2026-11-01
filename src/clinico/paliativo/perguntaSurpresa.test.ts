// node --experimental-strip-types --test src/clinico/paliativo/perguntaSurpresa.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { temReferenciaPediatrica } from '../ficha.ts'
import { fichaPerguntaSurpresa, LEITURA_PERGUNTA_SURPRESA, OPCOES_PERGUNTA_SURPRESA, perguntaSurpresaSeAplica } from './perguntaSurpresa.ts'

test('pergunta surpresa: só no adulto, nada para a criança', () => {
  assert.equal(fichaPerguntaSurpresa.publico, 'adulto')
  assert.equal(temReferenciaPediatrica(fichaPerguntaSurpresa), false)
  assert.equal(perguntaSurpresaSeAplica(14), true)
  assert.equal(perguntaSurpresaSeAplica(13), false)
  assert.equal(perguntaSurpresaSeAplica(null), false)
})

test('pergunta surpresa: fonte citada com PMID e DOI', () => {
  const f = fichaPerguntaSurpresa.fontes[0]
  assert.match(f.citacao, /PMID 28385893/)
  assert.equal(f.url, 'https://doi.org/10.1503/cmaj.160775')
})

test('pergunta surpresa: duas respostas, a positiva é "não ficaria surpreso"', () => {
  assert.deepEqual(OPCOES_PERGUNTA_SURPRESA.map((o) => o.valor), [0, 1])
  assert.match(LEITURA_PERGUNTA_SURPRESA[1], /^Positiva/)
  assert.match(LEITURA_PERGUNTA_SURPRESA[0], /^Negativa/)
})
