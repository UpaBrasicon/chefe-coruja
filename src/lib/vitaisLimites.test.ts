import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { alertaTemperatura, erroDeLimite, paraNumeros } from '../domain/vitais.ts'

// RT, 25/11/2026 (teste de fluxo A, A-1): os limites da triagem (dor de 0 a 10,
// Glasgow de 3 a 15) valem em todo registro de sinal vital, na tela e no
// servidor. Não há limite novo: os demais sinais entram crus.
test('dor de 0 a 10 e Glasgow de 3 a 15, inteiros, em todo formulário de sinais', () => {
  assert.deepEqual(paraNumeros({ 'escala-dor': '10', glasgow: '3', temperatura: '36,5' }), { 'escala-dor': 10, glasgow: 3, temperatura: 36.5 })
  for (const v of ['14', '-1', '7,5']) assert.throws(() => paraNumeros({ 'escala-dor': v }), /Dor pela escala numérica vai de 0 a 10\./)
  for (const v of ['20', '2', '9,5']) assert.throws(() => paraNumeros({ glasgow: v }), /Glasgow vai de 3 a 15\./)
  assert.equal(erroDeLimite('peso', 900), null, 'sinal que o RT não citou segue cru')
})

test('o servidor confere os mesmos limites, com as mesmas mensagens da triagem', () => {
  const sql = readFileSync('supabase/migrations/20270426000013_sinais_vitais_limites_da_triagem.sql', 'utf8')
  assert.match(sql, /Dor pela escala numérica vai de 0 a 10\./)
  assert.match(sql, /Glasgow vai de 3 a 15\./)
  assert.match(sql, /private\.validar_observacao\(\)/)
})

// RT, 25/11/2026 (segunda rodada do A-1): limites do possível e alerta da temperatura.
test('temperatura de 25 a 45 °C, saturação de 0 a 100 % e FC de 0 a 300 bpm; fora disso recusa', () => {
  assert.deepEqual(paraNumeros({ temperatura: '25', 'saturacao-o2': '100', 'frequencia-cardiaca': '300' }), { temperatura: 25, 'saturacao-o2': 100, 'frequencia-cardiaca': 300 })
  assert.deepEqual(paraNumeros({ temperatura: '45', 'saturacao-o2': '0', 'frequencia-cardiaca': '0' }), { temperatura: 45, 'saturacao-o2': 0, 'frequencia-cardiaca': 0 })
  for (const v of ['365', '24,9', '45,1']) assert.throws(() => paraNumeros({ temperatura: v }), /Temperatura impossível/)
  for (const v of ['140', '-1', '100,5']) assert.throws(() => paraNumeros({ 'saturacao-o2': v }), /Saturação impossível/)
  for (const v of ['-5', '301']) assert.throws(() => paraNumeros({ 'frequencia-cardiaca': v }), /Frequência cardíaca impossível/)
  // hipotermia grave real entra: 28 °C é registrado
  assert.deepEqual(paraNumeros({ temperatura: '28' }), { temperatura: 28 })
})

test('alerta da temperatura: hipotermia abaixo de 35, febre acima de 37,5, sem impedir', () => {
  assert.equal(alertaTemperatura('34,9'), 'hipotermia')
  assert.equal(alertaTemperatura('28'), 'hipotermia')
  assert.equal(alertaTemperatura('35'), null)
  assert.equal(alertaTemperatura('36,5'), null)
  assert.equal(alertaTemperatura('37,5'), null)
  assert.equal(alertaTemperatura('37,6'), 'febre')
  assert.equal(alertaTemperatura(''), null)
  assert.equal(alertaTemperatura('365'), null, 'valor impossível é erro, não alerta')
  const sql = readFileSync('supabase/migrations/20270426000016_sinais_vitais_limites_rt.sql', 'utf8')
  for (const m of ['Temperatura impossível: o registro aceita de 25 a 45 °C.', 'Saturação impossível: vai de 0 a 100 %%.', 'Frequência cardíaca impossível: o registro aceita de 0 a 300 bpm.']) assert.ok(sql.includes(m), m)
  // o alerta é só da tela: o servidor não grava marca nem faixa no sinal vital
  assert.doesNotMatch(sql, /hipotermia|febre/i)
})
