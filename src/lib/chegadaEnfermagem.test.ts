// node --experimental-strip-types --test src/lib/chegadaEnfermagem.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { linhaDaChegada, sairamAgora } from './chegadaEnfermagem.ts'

const base = {
  regulacao_id: 'r1', numero: 176, status: 'autorizada', nome: 'João P.', data_nascimento: '1972-01-10',
  origem: 'UPA F5', saida_em: null as string | null,
}
const agora = Date.parse('2026-11-08T17:30:00Z')

test('antes da saída: quem chega, de onde e o número', () => {
  assert.equal(linhaDaChegada(base, agora), 'Reservado · chega João P., 54a, da UPA F5 (regulação nº 176) · ainda não saiu da origem')
})

test('em trânsito: mostra a hora da saída (Brasília)', () => {
  assert.equal(
    linhaDaChegada({ ...base, status: 'em_transito', saida_em: '2026-11-08T17:10:00Z' }, agora),
    'Reservado · chega João P., 54a, da UPA F5 (regulação nº 176) · saiu às 14:10',
  )
})

test('o aviso de saída vale só para quem passou a em trânsito desde a última leitura', () => {
  const antes = [{ ...base }, { ...base, regulacao_id: 'r2', status: 'em_transito' }]
  const depois = [{ ...base, status: 'em_transito' }, { ...base, regulacao_id: 'r2', status: 'em_transito' }, { ...base, regulacao_id: 'r3', status: 'em_transito' }]
  assert.deepEqual(sairamAgora(antes, depois).map((c) => c.regulacao_id), ['r1', 'r3'])
})

test('na primeira leitura da tela não há aviso', () => {
  assert.deepEqual(sairamAgora(undefined, [{ ...base, status: 'em_transito' }]), [])
})
