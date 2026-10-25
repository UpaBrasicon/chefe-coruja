// node --experimental-strip-types --test src/clinico/escores/sincopeCanadense.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Respostas } from '../escore.ts'
import { sincopeCanadense } from './sincopeCanadense.ts'

/** Marcas ligadas pelo id; `dx` é o índice da opção de diagnóstico (0 vasovagal, 1 nenhum, 2 cardíaca). */
const r = (dx: number, ...ids: string[]): Respostas => ({
  ...Object.fromEntries(sincopeCanadense.itens.filter((i) => i.tipo === 'marca').map((i) => [i.id, ids.includes(i.id)])),
  diagnostico: dx,
})
const evento = (res: ReturnType<typeof sincopeCanadense.calcular>) => res!.derivados.find((d) => d[0].startsWith('Evento grave'))?.[1]

test('síncope canadense: vasovagal com predisposição = −3, muito baixo, 0,3% na validação de 2020', () => {
  const res = sincopeCanadense.calcular(r(0, 'vasovagal'))!
  assert.equal(res.valor, '-3')
  assert.equal(evento(res), '0,3%')
})
test('síncope canadense: cardíaca com troponina, QTc e PAS = 8, muito alto, 51,3%', () => {
  const res = sincopeCanadense.calcular(r(2, 'troponina', 'qtc', 'pas'))!
  assert.equal(res.valor, '8')
  assert.equal(res.estado, 2)
  assert.equal(evento(res), '51,3%')
})
test('síncope canadense: categorias sem percentual no resumo não mostram número', () => {
  assert.equal(evento(sincopeCanadense.calcular(r(1))), undefined)
  assert.equal(evento(sincopeCanadense.calcular(r(2, 'cardiopatia'))), undefined)
})
test('síncope canadense: três validações além da derivação', () => {
  assert.equal(sincopeCanadense.ficha.fontes.length, 4)
})
