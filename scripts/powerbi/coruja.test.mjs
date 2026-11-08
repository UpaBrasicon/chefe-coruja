// node --test scripts/powerbi/coruja.test.mjs
// Item 8 dos achados guardados (A em B1 a B6, 06/11/2026): a mesma lógica das
// consultas do Power BI (docs/api/powerbi/*.pq), em JavaScript, contra uma API
// falsa. Janelas de até 31 dias, paginação pelo proximo_cursor e espera no 429.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { janelas, listar } from './coruja.mjs'

test('janelas de até 31 dias, contíguas, com o fim exclusivo', () => {
  const fim = new Date('2026-11-06T12:00:00Z')
  const inicio = new Date(fim.getTime() - 90 * 864e5)
  const j = janelas(inicio, fim, 31)
  assert.equal(j.length, 3)
  assert.equal(j[0].desde, inicio.toISOString())
  assert.equal(j.at(-1).ate, fim.toISOString())
  for (let i = 1; i < j.length; i++) assert.equal(j[i].desde, j[i - 1].ate)
  for (const x of j) assert.ok(new Date(x.ate) - new Date(x.desde) <= 31 * 864e5)
})

test('período curto vira uma janela só; período vazio não gera janela', () => {
  const fim = new Date('2026-11-06T12:00:00Z')
  assert.equal(janelas(new Date(fim.getTime() - 5 * 864e5), fim, 31).length, 1)
  assert.deepEqual(janelas(fim, fim, 31), [])
})

// API falsa: três páginas e, uma vez, um 429 com Retry-After
function apiFalsa({ paginas, com429 = false }) {
  const chamadas = []
  let deu429 = !com429
  const buscar = async (caminho, query) => {
    chamadas.push({ caminho, query: { ...query } })
    if (!deu429 && query.cursor === 'c1') { deu429 = true; return { status: 429, retryAfter: 2, corpo: null } }
    const i = query.cursor ? Number(query.cursor.slice(1)) : 0
    return { status: 200, corpo: { dados: paginas[i], proximo_cursor: i + 1 < paginas.length ? `c${i + 1}` : null } }
  }
  return { buscar, chamadas }
}

test('segue o proximo_cursor até o fim e junta os dados', async () => {
  const api = apiFalsa({ paginas: [[1, 2], [3, 4], [5]] })
  const dados = await listar(api.buscar, 'leitos', { unidade_id: 'u', limite: '100' }, { esperar: async () => {} })
  assert.deepEqual(dados, [1, 2, 3, 4, 5])
  assert.deepEqual(api.chamadas.map((c) => c.query.cursor ?? null), [null, 'c1', 'c2'])
  assert.ok(api.chamadas.every((c) => c.query.unidade_id === 'u' && c.query.limite === '100'))
})

test('no 429 espera o Retry-After e repete a mesma página', async () => {
  const api = apiFalsa({ paginas: [[1], [2], [3]], com429: true })
  const esperas = []
  const dados = await listar(api.buscar, 'leitos', {}, { esperar: async (s) => { esperas.push(s) } })
  assert.deepEqual(dados, [1, 2, 3])
  assert.deepEqual(esperas, [2])
  assert.deepEqual(api.chamadas.map((c) => c.query.cursor ?? null), [null, 'c1', 'c1', 'c2'])
})

test('lista vazia termina na primeira página', async () => {
  const api = apiFalsa({ paginas: [[]] })
  assert.deepEqual(await listar(api.buscar, 'leitos', {}, { esperar: async () => {} }), [])
  assert.equal(api.chamadas.length, 1)
})

test('429 seguidos: desiste depois de 5 tentativas, com erro claro', async () => {
  const buscar = async () => ({ status: 429, retryAfter: 1, corpo: null })
  await assert.rejects(listar(buscar, 'leitos', {}, { esperar: async () => {} }), /limite por minuto/)
})

test('outro erro da API para na hora, com o código', async () => {
  const buscar = async () => ({ status: 403, corpo: { title: 'Recurso fora da chave' } })
  await assert.rejects(listar(buscar, 'leitos', {}, { esperar: async () => {} }), /403/)
})
