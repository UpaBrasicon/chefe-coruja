// node --experimental-strip-types --test src/lib/filtrosBi.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { argsFiltros, descreverFiltros, escreverFiltros, lerFiltros } from './filtrosBi.ts'

const HOJE = '2026-10-07'
const U = '10000000-0000-4000-8000-000000000002'

test('endereço vazio: 7 dias, sem filtro', () => {
  const f = lerFiltros(new URLSearchParams(''), HOJE)
  assert.equal(f.periodo, '7d')
  assert.equal(escreverFiltros(f).toString(), '')
  assert.deepEqual(argsFiltros(f, HOJE).args, {
    p_de: '2026-10-01', p_ate: '2026-10-07',
    p_setor: undefined, p_cor: undefined, p_turno: undefined, p_publico: undefined, p_medico: undefined,
  })
})

test('ida e volta pelo endereço', () => {
  const q = new URLSearchParams(`periodo=intervalo&de=2026-09-01&ate=2026-09-15&cor=laranja&turno=noite&grupo=pediatrico&medico=${U}`)
  const f = lerFiltros(q, HOJE)
  assert.equal(escreverFiltros(f).toString(), q.toString())
  const a = argsFiltros(f, HOJE).args
  assert.equal(a.p_de, '2026-09-01')
  assert.equal(a.p_cor, 'laranja')
  assert.equal(a.p_publico, 'pediatrico')
  assert.equal(a.p_medico, U)
})

test('valor estranho no endereço vira o padrão', () => {
  const f = lerFiltros(new URLSearchParams('periodo=ano&cor=roxo&turno=x&setor=abc&de=ontem'), HOJE)
  assert.equal(f.periodo, '7d')
  assert.equal(f.cor, '')
  assert.equal(f.turno, '')
  assert.equal(f.setor, '')
  assert.equal(f.de, HOJE)
})

test('descrição para o CSV', () => {
  const f = lerFiltros(new URLSearchParams(`cor=verde&turno=manha&medico=${U}`), HOJE)
  assert.equal(descreverFiltros(f, { medico: 'Dra. Ana' }), 'cor verde, turno manhã, médico Dra. Ana')
  assert.equal(descreverFiltros(lerFiltros(new URLSearchParams(''), HOJE), {}), 'sem filtro')
})
