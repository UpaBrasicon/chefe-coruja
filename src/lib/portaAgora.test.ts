// node --experimental-strip-types --test src/lib/portaAgora.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gargalo, tempo, type Porta } from './portaAgora.ts'

const etapas = (e: Partial<Porta['etapas']>): Pick<Porta, 'etapas'> => ({
  etapas: {
    triagem: { n: 0 }, aguardando_medico: { n: 0, fora_alvo: 0 }, em_atendimento: { n: 0 },
    medicacao_pendente: { n: 0 }, observacao: { n: 0, acima_6h: 0 }, altas_hoje: { n: 0 }, ...e,
  },
})

test('tempo: minutos e horas por extenso', () => {
  assert.equal(tempo(null), '—')
  assert.equal(tempo(0), '0 min')
  assert.equal(tempo(59), '59 min')
  assert.equal(tempo(60), '1 h')
  assert.equal(tempo(135), '2 h 15 min')
})

test('gargalo: atraso vence a fila maior e é crítico', () => {
  const g = gargalo(etapas({ triagem: { n: 9 }, aguardando_medico: { n: 2, fora_alvo: 1 } }))
  assert.deepEqual(g, { chave: 'aguardando_medico', motivo: '1 fora do tempo-alvo da cor', critico: true })
})

test('gargalo: entre atrasos, o maior número', () => {
  const g = gargalo(etapas({ aguardando_medico: { n: 3, fora_alvo: 1 }, observacao: { n: 4, acima_6h: 3 } }))
  assert.equal(g?.chave, 'observacao')
  assert.equal(g?.motivo, '3 acima de 6 horas')
})

test('gargalo: sem atraso, a maior fila, em atenção; altas não contam', () => {
  const g = gargalo(etapas({ triagem: { n: 2 }, em_atendimento: { n: 5 }, altas_hoje: { n: 30 } }))
  assert.deepEqual(g, { chave: 'em_atendimento', motivo: 'maior fila agora', critico: false })
})

test('gargalo: porta vazia, sem gargalo', () => {
  assert.equal(gargalo(etapas({ altas_hoje: { n: 4 } })), null)
})
