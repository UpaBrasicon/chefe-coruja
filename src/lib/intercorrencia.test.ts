// node --experimental-strip-types --test src/lib/intercorrencia.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { versoesAnteriores, vigentes, type Intercorrencia } from './intercorrencia.ts'

const i = (id: string, ocorrida: string, retifica: string | null, retificada: boolean): Intercorrencia => ({
  id, episodio_id: 'e', internacao_id: null, tipo: 'queda', tipo_rotulo: 'Queda', gravidade: 'leve', ocorrida_em: ocorrida,
  descricao: 'x', conduta: 'y', setor: null, registrado_por: null, papel: 'enfermeiro', registrado_em: ocorrida,
  retifica_id: retifica, retificada,
})

test('só a versão vigente, da mais nova', () => {
  const l = [i('a', '2026-10-08T10:00:00Z', null, true), i('b', '2026-10-08T10:00:00Z', 'a', false), i('c', '2026-10-08T12:00:00Z', null, false)]
  assert.deepEqual(vigentes(l).map((x) => x.id), ['c', 'b'])
})

test('cadeia de retificações', () => {
  const l = [i('a', 't', null, true), i('b', 't', 'a', true), i('c', 't', 'b', false)]
  assert.deepEqual(versoesAnteriores(l, l[2]).map((x) => x.id), ['b', 'a'])
  assert.deepEqual(versoesAnteriores(l, l[0]), [])
})
