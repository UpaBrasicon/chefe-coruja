import { test } from 'node:test'
import assert from 'node:assert/strict'

import { criarLoteador } from './loteador.ts'

// Item 08 do kit de desempenho (docs/desempenho/AUDITORIA.md, seção 3.1): o
// painel de observação e a checagem pediam as alergias de cada paciente numa
// chamada própria. O loteador junta os pedidos do mesmo instante numa chamada.

type Resp = Record<string, { dados?: string; erro?: string }>

function registro() {
  const lotes: string[][] = []
  const buscar = async (chaves: string[]): Promise<Resp> => {
    lotes.push([...chaves])
    return Object.fromEntries(chaves.map((c) => [c, c.startsWith('x') ? { erro: `Acesso negado ${c}` } : { dados: `v-${c}` }]))
  }
  return { lotes, buscar }
}

test('pedidos do mesmo instante viram uma chamada só', async () => {
  const r = registro()
  const l = criarLoteador(r.buscar, { maximo: 200 })
  const valores = await Promise.all(['a', 'b', 'c'].map((k) => l.carregar(k)))
  assert.deepEqual(valores, ['v-a', 'v-b', 'v-c'])
  assert.equal(r.lotes.length, 1)
  assert.deepEqual(r.lotes[0], ['a', 'b', 'c'])
})

test('a mesma chave pedida duas vezes vai uma vez no lote', async () => {
  const r = registro()
  const l = criarLoteador(r.buscar, { maximo: 200 })
  const [x, y] = await Promise.all([l.carregar('a'), l.carregar('a')])
  assert.equal(x, 'v-a')
  assert.equal(y, 'v-a')
  assert.deepEqual(r.lotes, [['a']])
})

test('erro de um item rejeita só aquele item, com a mensagem do servidor', async () => {
  const r = registro()
  const l = criarLoteador(r.buscar, { maximo: 200 })
  const [ok, ruim] = await Promise.allSettled([l.carregar('a'), l.carregar('x1')])
  assert.deepEqual(ok, { status: 'fulfilled', value: 'v-a' })
  assert.equal(ruim.status, 'rejected')
  assert.match((ruim as PromiseRejectedResult).reason.message, /Acesso negado x1/)
})

test('falha da chamada inteira rejeita todos com o mesmo erro (segundo fator, rede)', async () => {
  const erro = Object.assign(new Error('Segundo fator pendente.'), { code: 'P0001' })
  const l = criarLoteador(async () => { throw erro }, { maximo: 200 })
  const res = await Promise.allSettled([l.carregar('a'), l.carregar('b')])
  for (const r of res) {
    assert.equal(r.status, 'rejected')
    assert.equal((r as PromiseRejectedResult).reason, erro)
  }
})

test('item que o servidor não devolveu é rejeitado, não fica pendurado', async () => {
  const l = criarLoteador(async () => ({}), { maximo: 200 })
  await assert.rejects(l.carregar('a'), /sem resposta/)
})

test('acima do máximo divide em vários lotes', async () => {
  const r = registro()
  const l = criarLoteador(r.buscar, { maximo: 2 })
  const valores = await Promise.all(['a', 'b', 'c', 'd', 'e'].map((k) => l.carregar(k)))
  assert.deepEqual(valores, ['v-a', 'v-b', 'v-c', 'v-d', 'v-e'])
  assert.deepEqual(r.lotes, [['a', 'b'], ['c', 'd'], ['e']])
})

test('pedidos em instantes diferentes vão em lotes diferentes', async () => {
  const r = registro()
  const l = criarLoteador(r.buscar, { maximo: 200 })
  await l.carregar('a')
  await l.carregar('b')
  assert.deepEqual(r.lotes, [['a'], ['b']])
})
