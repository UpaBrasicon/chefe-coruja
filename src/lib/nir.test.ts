// node --experimental-strip-types --test src/lib/nir.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { categoriaCobranca, filtrarPendencias, type PendenciaNir } from './nir.ts'

const p = (tipo: string, grupo: PendenciaNir['grupo'], parado_seg: number): PendenciaNir => ({
  tipo, grupo, ref_id: tipo, titulo: tipo, desde: '2026-10-11T00:00:00Z', parado_seg,
  paciente: null, responsavel: null, responsaveis: [], pode_cobrar: false, ultima_cobranca: null,
})

test('NIR: filtro por assunto e mais antigas primeiro', () => {
  const itens = [p('aih_sem_decisao', 'aih', 100), p('reg_chegada', 'regulacao', 900), p('aih_rejeitada', 'aih', 500)]
  assert.deepEqual(filtrarPendencias(itens, 'todos').map((x) => x.tipo), ['reg_chegada', 'aih_rejeitada', 'aih_sem_decisao'])
  assert.deepEqual(filtrarPendencias(itens, 'aih').map((x) => x.tipo), ['aih_rejeitada', 'aih_sem_decisao'])
  assert.deepEqual(filtrarPendencias(itens, 'apac'), [])
  assert.equal(itens[0].tipo, 'aih_sem_decisao') // não altera a lista original
})

test('NIR: categoria da cobrança nos Avisos', () => {
  assert.equal(categoriaCobranca('nir_aih_1a2b3c4d'), 'AIH')
  assert.equal(categoriaCobranca('nir_apac_1a2b3c4d'), 'APAC')
  assert.equal(categoriaCobranca('reg_cobranca_12'), null)
})
