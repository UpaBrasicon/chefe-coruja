import assert from 'node:assert/strict'
import { test } from 'node:test'

import { corDoPeso, lerPesoTexto } from './fitaDoPeso.ts'

// Peso digitado → cor da fita (RT, 17/11/2026), pela tabela aprovada (Oommen 2021, Tabela 5).
const cor = (kg: number) => {
  const r = corDoPeso(kg)
  return r.tipo === 'cor' ? r.cor.id : r.tipo === 'entre' ? `entre:${r.abaixo.id}-${r.acima.id}` : r.tipo === 'fora' ? `fora:${r.motivo}` : r.tipo
}

test('peso dentro da faixa escolhe a cor, nos limites também', () => {
  assert.equal(cor(3), 'cinza')
  assert.equal(cor(6.5), 'rosa')
  assert.equal(cor(13), 'amarelo')
  assert.equal(cor(22), 'azul')
  assert.equal(cor(36), 'verde')
})

test('no vão entre cores, nenhuma cor; fora da fita, avisa', () => {
  assert.equal(cor(5.5), 'entre:cinza-rosa')
  assert.equal(cor(23), 'entre:azul-laranja')
  assert.equal(cor(2.5), 'fora:abaixo')
  assert.equal(cor(40), 'fora:acima')
  assert.equal(corDoPeso(null).tipo, 'vazio')
})

test('lê o peso digitado com vírgula', () => {
  assert.equal(lerPesoTexto('6,5'), 6.5)
  assert.equal(lerPesoTexto(''), null)
  assert.equal(lerPesoTexto('abc'), null)
})
