import { test } from 'node:test'
import assert from 'node:assert/strict'

import { faltaNoItem, trechosAchados } from './buscaMedicamento.ts'

const achados = (texto: string, termo: string) => trechosAchados(texto, termo).filter((x) => x.achou).map((x) => x.t)

test('destaca cada palavra digitada, sem acento e sem diferença de maiúscula', () => {
  assert.deepEqual(achados('Ácido acetilsalicílico', 'acido'), ['Ácido'])
  assert.deepEqual(achados('Amoxicilina + clavulanato', 'clav amoxi'), ['Amoxi', 'clav'])
  assert.deepEqual(achados('Dipirona sódica', 'sodica'), ['sódica'])
})

test('o texto continua inteiro, só dividido', () => {
  const t = 'Cloreto de sódio'
  assert.equal(trechosAchados(t, 'sod').map((x) => x.t).join(''), t)
})

test('palavra de uma letra e termo vazio não destacam', () => {
  assert.deepEqual(achados('Dipirona', 'd'), [])
  assert.deepEqual(trechosAchados('Dipirona', ''), [{ t: 'Dipirona', achou: false }])
})

test('o que falta para prescrever, na ordem da tela', () => {
  const vazio = { med: false, dose: '', via: '', posologia: '', porta: false }
  assert.deepEqual(faltaNoItem(vazio), ['medicamento', 'dose', 'via', 'frequência'])
  assert.deepEqual(faltaNoItem({ ...vazio, porta: true }), ['medicamento', 'dose', 'via'])
  assert.deepEqual(faltaNoItem({ med: true, dose: '1 g', via: 'EV', posologia: '8/8h', porta: false }), [])
  assert.deepEqual(faltaNoItem({ med: true, dose: '1 g', via: 'EV', posologia: '8/8h', porta: false }, ['peso', 'idade']),
    ['idade', 'peso deste atendimento'])
})
