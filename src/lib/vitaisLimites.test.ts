import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { erroDeLimite, paraNumeros } from '../domain/vitais.ts'

// RT, 25/11/2026 (teste de fluxo A, A-1): os limites da triagem (dor de 0 a 10,
// Glasgow de 3 a 15) valem em todo registro de sinal vital, na tela e no
// servidor. Não há limite novo: os demais sinais entram crus.
test('dor de 0 a 10 e Glasgow de 3 a 15, inteiros, em todo formulário de sinais', () => {
  assert.deepEqual(paraNumeros({ 'escala-dor': '10', glasgow: '3', temperatura: '36,5' }), { 'escala-dor': 10, glasgow: 3, temperatura: 36.5 })
  for (const v of ['14', '-1', '7,5']) assert.throws(() => paraNumeros({ 'escala-dor': v }), /Dor pela escala numérica vai de 0 a 10\./)
  for (const v of ['20', '2', '9,5']) assert.throws(() => paraNumeros({ glasgow: v }), /Glasgow vai de 3 a 15\./)
  assert.equal(erroDeLimite('temperatura', 365), null, 'sem limite na triagem, sem limite aqui')
})

test('o servidor confere os mesmos limites, com as mesmas mensagens da triagem', () => {
  const sql = readFileSync('supabase/migrations/20270426000013_sinais_vitais_limites_da_triagem.sql', 'utf8')
  assert.match(sql, /Dor pela escala numérica vai de 0 a 10\./)
  assert.match(sql, /Glasgow vai de 3 a 15\./)
  assert.match(sql, /private\.validar_observacao\(\)/)
})
