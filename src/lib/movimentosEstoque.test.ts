import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { comSinal, rotuloMovimento, TIPOS_MOVIMENTO } from './movimentosEstoque.ts'

test('quantidade com sinal', () => {
  assert.equal(comSinal(10), '+10')
  assert.equal(comSinal(-3), '−3')
  assert.equal(comSinal(0), '0')
  assert.equal(comSinal(1500), '+1.500')
})

test('rótulo do tipo de movimento', () => {
  assert.equal(rotuloMovimento('ajuste_inventario'), 'Ajuste de inventário')
  assert.equal(rotuloMovimento('desconhecido'), 'desconhecido')
})

test('os tipos são os mesmos que o banco aceita', () => {
  const migration = readFileSync('supabase/migrations/20270110000001_movimentos_estoque.sql', 'utf8')
  const check = migration.slice(migration.indexOf('tipo            text NOT NULL CHECK'), migration.indexOf("'ajuste_inventario'))") + 22)
  assert.deepEqual([...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]), TIPOS_MOVIMENTO.map(([k]) => k))
})

// o saldo da Disponibilidade não se sobrescreve mais sem motivo: entrada com
// documento ou ajuste de inventário com motivo
test('a ficha do estoque usa entrada e ajuste, e não o saldo solto', () => {
  const tela = readFileSync('src/pages/farmacia/Farmacia.tsx', 'utf8')
  const ficha = tela.slice(tela.indexOf('function FichaEstoque('), tela.indexOf('// ── Faltas'))
  assert.match(ficha, /registrar_entrada_estoque/)
  assert.match(ficha, /ajustar_estoque/)
  assert.match(ficha, /extrato_estoque/)
  assert.doesNotMatch(ficha, /atualizar_estoque'[^)]*num\(q\)/)
})
