import { test } from 'node:test'
import assert from 'node:assert/strict'

import { detalhesDaTransferencia, regulacoesDaAlta, rotuloRegulacaoAlta, type RegulacaoDoHistorico } from './regulacaoAlta.ts'

const r = (x: Partial<RegulacaoDoHistorico>): RegulacaoDoHistorico =>
  ({ id: 'r', numero: 1, status: 'autorizada', tipo: 'transferencia', destino: 'Hospital F5', outra_unidade: false, ...x })

test('S4: oferece só leito e transferência desta unidade, em curso e com destino', () => {
  const itens = [
    r({ id: 'a' }),
    r({ id: 'b', tipo: 'leito', status: 'em_transito' }),
    r({ id: 'c', status: 'agendada' }),
    r({ id: 'd', tipo: 'consulta' }),
    r({ id: 'e', status: 'realizada' }),
    r({ id: 'f', status: 'aguardando_destino' }),
    r({ id: 'g', outra_unidade: true }),
    r({ id: 'h', destino: null }),
  ]
  assert.deepEqual(regulacoesDaAlta(itens).map((x) => x.id), ['a', 'b', 'c'])
})

test('S4: rótulo com o número, o destino e a marca de chegada', () => {
  assert.equal(rotuloRegulacaoAlta(r({ numero: 94 })), 'Regulação nº 94 · Hospital F5')
  assert.equal(rotuloRegulacaoAlta(r({ numero: 94, chegou_origem_aberta: true })), 'Regulação nº 94 · Hospital F5 (já chegou ao destino)')
})

test('S4: com regulação, o destino vem dela e vai o id; sem, o destino escrito', () => {
  assert.deepEqual(detalhesDaTransferencia(r({ id: 'x', destino: ' Hospital F5 ' }), 'outro'), { destino: 'Hospital F5', regulacao_id: 'x' })
  assert.deepEqual(detalhesDaTransferencia(null, ' Hospital Particular '), { destino: 'Hospital Particular' })
})
