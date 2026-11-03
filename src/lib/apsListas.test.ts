import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CONDUTAS_APS, PROBLEMAS_APS, TIPOS_ATENDIMENTO_APS } from '../domain/aps.ts'

// 5A, tarefa 2: as listas da ficha do e-SUS APS na tela são as mesmas do banco
// (private.lista_aps, migration 20270211000002_atendimento_ubs.sql).
const migration = readFileSync('supabase/migrations/20270211000002_atendimento_ubs.sql', 'utf8').replace(/\r/g, '')
const lista = (nome: string) => {
  const m = migration.match(new RegExp(`WHEN '${nome}' THEN ARRAY\\[([^\\]]*)\\]`))
  assert.ok(m, `lista ${nome} não encontrada na migration`)
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort()
}
const valores = (l: { valor: string }[]) => l.map((o) => o.valor).sort()

test('tipos de atendimento iguais aos do banco', () => {
  assert.deepEqual(valores(TIPOS_ATENDIMENTO_APS), lista('tipo_atendimento'))
})

test('problemas/condições iguais aos do banco', () => {
  assert.deepEqual(valores(PROBLEMAS_APS), lista('problema'))
})

test('condutas iguais às do banco', () => {
  assert.deepEqual(valores(CONDUTAS_APS), lista('conduta'))
})
