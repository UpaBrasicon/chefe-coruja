import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Ponto 2 das telas do farmacêutico (RT, 27/10/2026): a diluição nova é da
// unidade, e o modelo da rede só o super admin muda (migration 20270109000001).
const tela = readFileSync('src/pages/farmacia/Diluicoes.tsx', 'utf8')

test('a Nova diluição manda a unidade ao banco', () => {
  assert.match(tela, /salvar_diluicao', \{ p_id: undefined as unknown as string, p_dados: \{[^}]*unidade_id: unidade/)
})

test('a Nova diluição oferece as cinco vias que a tabela aceita', () => {
  assert.match(tela, /\['EV', 'IM', 'SC', 'IN', 'VO'\]/)
})

test('o modelo da rede não é editável pela farmácia', () => {
  assert.match(tela, /const editavel = \(d\.status === 'rascunho' \|\| d\.status === 'revisado'\) && !daRede/)
})
