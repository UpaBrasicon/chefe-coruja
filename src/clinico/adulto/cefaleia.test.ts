// node --experimental-strip-types --test src/clinico/adulto/cefaleia.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { SINAIS, TRATAMENTO, avaliarSinais } from './cefaleia.ts'

test('cefaleia: SNNOOP10 tem os 15 sinais do resumo', () => {
  assert.equal(SINAIS.length, 15)
  assert.equal(new Set(SINAIS.map((s) => s.id)).size, 15)
})
test('cefaleia: nenhum sinal = nenhuma linha de investigação', () => {
  assert.deepEqual(avaliarSinais([]), { alarmes: 0, linhas: [], semLinha: [] })
})
test('cefaleia: início súbito traz a linha da Tabela 2 com punção após a neuroimagem', () => {
  const a = avaliarSinais(['subita'])
  assert.equal(a.alarmes, 1)
  assert.match(a.linhas[0].investigacao, /punção lombar após a neuroimagem/)
})
test('cefaleia: neoplasia e HIV caem na mesma linha, sem repetir', () => {
  const a = avaliarSinais(['neoplasia', 'imunidade'])
  assert.equal(a.alarmes, 2)
  assert.equal(a.linhas.length, 1)
})
test('cefaleia: sinal sem linha no manual aparece à parte', () => {
  assert.deepEqual(avaliarSinais(['posicional']).semLinha, ['Cefaleia posicional'])
})
test('cefaleia: só as doses que o capítulo traz (dexametasona 10 mg, difenidramina 12,5 mg, sumatriptano 6 mg SC)', () => {
  const textos = Object.values(TRATAMENTO).flatMap((t) => t.itens.map((i) => i.texto)).join(' ')
  assert.match(textos, /10 mg EV/)
  assert.match(textos, /12,5 mg EV/)
  assert.match(textos, /6 mg SC/)
  assert.doesNotMatch(textos, /dipirona \d|metoclopramida \d/)
})
