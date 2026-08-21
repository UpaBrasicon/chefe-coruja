// Testes da normalização de telefone (Fase 1 Hermes)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizarE164BR, soDigitos, telefoneCorrespondeWaId } from './telefone.ts'

test('soDigitos remove tudo que não é dígito', () => {
  assert.equal(soDigitos('(11) 99999-0001'), '11999990001')
  assert.equal(soDigitos('+55 11 99999-0001'), '5511999990001')
  assert.equal(soDigitos(''), '')
})

test('normalizarE164BR — formatos brasileiros comuns → E.164 sem +', () => {
  // fixo: (11) 9999-0001 → 10 dígitos
  assert.equal(normalizarE164BR('(11) 9999-0001'), '551199990001')
  // celular: +55 (11) 99999-0001 → 13 dígitos
  assert.equal(normalizarE164BR('+55 11 99999-0001'), '5511999990001')
  // já E.164 (13 dígitos)
  assert.equal(normalizarE164BR('5511999990001'), '5511999990001')
  // zero à esquerda (0DD + número)
  assert.equal(normalizarE164BR('011 99999-0001'), '5511999990001')
  // DDD + celular sem zero (11 dígitos)
  assert.equal(normalizarE164BR('11999990001'), '5511999990001')
})

test('normalizarE164BR — mantém E.164 com 12 dígitos (fixo com 55)', () => {
  // 55 + (11) 9999-0001 → 12 dígitos
  assert.equal(normalizarE164BR('551199990001'), '551199990001')
})

test('normalizarE164BR — rejeita formatos inválidos', () => {
  assert.equal(normalizarE164BR(''), null)
  assert.equal(normalizarE164BR('9999-0001'), null) // 8 dígitos (sem DDD)
  assert.equal(normalizarE164BR('abc'), null)
  assert.equal(normalizarE164BR('55x'), null) // 2 dígitos apenas
})

test('normalizarE164BR — 13 dígitos iniciando 55 é mantido', () => {
  assert.equal(normalizarE164BR('5511999990001'), '5511999990001')
})

test('normalizarE164BR — 14 dígitos é rejeitado (não é telefone BR)', () => {
  assert.equal(normalizarE164BR('55119999900001'), null)
})

test('telefoneCorrespondeWaId — wa_id da Meta sem "+"', () => {
  assert.equal(telefoneCorrespondeWaId('(11) 99999-0001', '5511999990001'), true)
  assert.equal(telefoneCorrespondeWaId('+5511999990001', '5511999990001'), true)
  assert.equal(telefoneCorrespondeWaId('5511999990001', '5511999990001'), true)
})

test('telefoneCorrespondeWaId — não corresponde', () => {
  assert.equal(telefoneCorrespondeWaId('(11) 99999-0001', '5511888880001'), false)
  assert.equal(telefoneCorrespondeWaId('', '5511999990001'), false)
})
