import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 7 dos achados guardados (A em H1 a H5, 06/11/2026).
const cartao = readFileSync('src/components/prontuario/HistoricoEncerrado.tsx', 'utf8')

test('sem rolagem dentro do cartão (H3)', () => {
  assert.doesNotMatch(cartao, /max-h-\[320px\]/)
  assert.doesNotMatch(cartao, /overflow-y-auto/)
})

test('cinco de início, "Ver todos" e separador de ano (H1 e H4)', () => {
  assert.match(cartao, /INICIAIS_HISTORICO/)
  assert.match(cartao, /Ver todos os/)
  assert.match(cartao, /agruparPorAno/)
})

test('resumo no topo (H2) e o resto como estava (H5)', () => {
  assert.match(cartao, /resumoHistorico/)
  assert.match(cartao, /historico_encerrado/)
  assert.match(cartao, /abrir_historico_encerrado/)
  assert.match(cartao, /Resumo sem texto clínico/)
})
