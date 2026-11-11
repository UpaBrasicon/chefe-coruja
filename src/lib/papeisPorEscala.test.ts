// node --experimental-strip-types --test src/lib/papeisPorEscala.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { PAPEIS_POR_ESCALA } from './constants.ts'

// M12 (decisão 7 do RT de 27/10/2026, ligada em 11/11/2026): todo mundo entra
// pela escala, menos administrador e gestor.
test('farmacêutico e faturamento entram pela escala (M12)', () => {
  assert.ok(PAPEIS_POR_ESCALA.includes('farmaceutico'))
  assert.ok(PAPEIS_POR_ESCALA.includes('faturamento'))
})
test('administrador e gestor continuam fora da escala', () => {
  assert.ok(!PAPEIS_POR_ESCALA.includes('admin'))
  assert.ok(!PAPEIS_POR_ESCALA.includes('gestor'))
})
