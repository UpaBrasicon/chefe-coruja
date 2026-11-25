import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  avaliarMeta, avaliarNoMes, conferirMeta, deslocarMes, INDICADORES_META, mesesPadrao, mesesParaEscolher, metaDoMes, parte,
  primeiroDia, variacao, type BoletimMes, type MetaContrato,
} from './boletim.ts'

// Boletim bimestral do Gestor da secretaria (pedido do RT, 24/11/2026).

test('meses: desloca através da virada do ano', () => {
  assert.equal(deslocarMes('2026-01', -1), '2025-12')
  assert.equal(deslocarMes('2026-12', 1), '2027-01')
  assert.equal(deslocarMes('2026-10', -14), '2025-08')
  assert.equal(deslocarMes('2026-10', 0), '2026-10')
  assert.equal(primeiroDia('2026-09'), '2026-09-01')
})

test('meses: abre nos dois últimos meses completos', () => {
  assert.deepEqual(mesesPadrao('2026-11-24'), { a: '2026-09', b: '2026-10' })
  assert.deepEqual(mesesPadrao('2026-01-03'), { a: '2025-11', b: '2025-12' })
  assert.deepEqual(mesesPadrao('2026-02-01'), { a: '2025-12', b: '2026-01' })
})

test('meses: a escolha começa no mês corrente e volta', () => {
  const m = mesesParaEscolher('2026-11-24', 3)
  assert.deepEqual(m, ['2026-11', '2026-10', '2026-09'])
})

test('variação: sobe, desce, igual e sem base', () => {
  assert.deepEqual(variacao(298, 845), { direcao: 'sobe', diferenca: 547, pct: 183.6 })
  assert.deepEqual(variacao(97, 93), { direcao: 'desce', diferenca: -4, pct: -4.1 })
  assert.deepEqual(variacao(5, 5), { direcao: 'igual', diferenca: 0, pct: 0 })
  assert.deepEqual(variacao(0, 3), { direcao: 'sobe', diferenca: 3, pct: null })
  assert.equal(variacao(null, 3), null)
  assert.equal(variacao(3, undefined), null)
})

test('parte: porcentagem com uma casa, sem total não há parte', () => {
  assert.equal(parte(130, 136), 95.6)
  assert.equal(parte(0, 0), null)
})

const meta = (p: Partial<MetaContrato>): MetaContrato => ({
  id: 'm', indicador: 'taxa_atendimento', meta: 95, sentido: 'maior', peso: null, vigente_de: '2026-01-01', vigente_ate: null, ...p,
})

test('metas: a vigente no mês, a mais recente quando há duas', () => {
  const metas = [
    meta({ id: 'velha', vigente_de: '2026-01-01', vigente_ate: '2026-09-30' }),
    meta({ id: 'nova', vigente_de: '2026-10-01' }),
    meta({ id: 'outra', indicador: 'retorno_72h' }),
  ]
  assert.equal(metaDoMes(metas, 'taxa_atendimento', '2026-09')?.id, 'velha')
  assert.equal(metaDoMes(metas, 'taxa_atendimento', '2026-10')?.id, 'nova')
  assert.equal(metaDoMes(metas, 'taxa_atendimento', '2025-12'), null)
  // vigência que começa no meio do mês vale para o mês
  assert.equal(metaDoMes([meta({ vigente_de: '2026-10-15' })], 'taxa_atendimento', '2026-10')?.vigente_de, '2026-10-15')
})

test('metas: cumpriu pelo sentido; sem realizado não avalia', () => {
  assert.equal(avaliarMeta(97, 95, 'maior'), 'cumpriu')
  assert.equal(avaliarMeta(95, 95, 'maior'), 'cumpriu')
  assert.equal(avaliarMeta(93, 95, 'maior'), 'nao_cumpriu')
  assert.equal(avaliarMeta(6, 6, 'menor'), 'cumpriu')
  assert.equal(avaliarMeta(7, 6, 'menor'), 'nao_cumpriu')
  assert.equal(avaliarMeta(null, 6, 'menor'), 'sem_dado')
})

test('metas: avalia o mês do boletim pelo catálogo', () => {
  const mes = { mes: '2026-10-01', porta: { taxa_atendimento: 93 } } as unknown as BoletimMes
  const r = avaliarNoMes(mes, [meta({})], 'taxa_atendimento')
  assert.equal(r?.avaliacao, 'nao_cumpriu')
  assert.equal(r?.realizado, 93)
  assert.equal(avaliarNoMes(mes, [], 'taxa_atendimento'), null)
})

test('metas: catálogo sem chave repetida e no padrão do banco', () => {
  const chaves = INDICADORES_META.map((i) => i.chave)
  assert.equal(new Set(chaves).size, chaves.length)
  for (const c of chaves) assert.match(c, /^[a-z0-9_]{3,60}$/)
})

test('metas: o formulário confere antes de gravar', () => {
  const ok = { indicador: 'taxa_atendimento', meta: '95', peso: '', vigente_de: '2026-01-01', vigente_ate: '' }
  assert.equal(conferirMeta(ok), null)
  assert.equal(conferirMeta({ ...ok, indicador: '' }), 'Escolha o indicador.')
  assert.equal(conferirMeta({ ...ok, meta: '' }), 'A meta é um número de zero para cima.')
  assert.equal(conferirMeta({ ...ok, meta: '120' }), 'Porcentagem vai até 100.')
  assert.equal(conferirMeta({ ...ok, meta: '95,5' }), null)
  assert.equal(conferirMeta({ ...ok, peso: '150' }), 'O peso vai de 0 a 100.')
  assert.equal(conferirMeta({ ...ok, vigente_ate: '2025-12-31' }), 'O fim da vigência vem depois do início.')
  assert.equal(conferirMeta({ ...ok, indicador: 'fichas_atendidas', meta: '12000' }), null)
})
