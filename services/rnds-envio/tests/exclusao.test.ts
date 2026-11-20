// Percurso da UBS, U15, vacina: a vacina cancelada depois de enviada vira o FHIR
// Delete do RIA na RNDS (Manual RIA-R v1.9, 3.3 e 8).
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { classificarExclusao } from '../src/cliente-rnds.ts'
import { processarLote, type Dependencias, type DocumentoCarregado, type Registro } from '../src/ciclo.ts'

const UNIDADE = '00000000-0000-4000-8000-000000000001'
const resp = (status: number, corpo = '') => ({ status, headers: {}, corpo })

test('exclusão: 204 e 410 cumprem o pedido; 404 é erro; 5xx tenta de novo', () => {
  assert.equal(classificarExclusao(resp(204), 'abc').resultado, 'enviado')
  assert.equal(classificarExclusao(resp(410), 'abc').resultado, 'enviado')
  assert.equal(classificarExclusao(resp(404), 'abc').resultado, 'erro')
  assert.equal(classificarExclusao(resp(503), 'abc').resultado, 'reenviar')
  assert.equal(classificarExclusao(resp(401), 'abc').resultado, 'credencial')
})

function deps(doc: DocumentoCarregado, registros: Registro[], chamadas: unknown[]): Dependencias {
  return {
    fila: {
      async pegarLote() { return [{ id: 'x', unidade_id: UNIDADE, tentativas: 0, tipo_documento: 'ria' }] },
      async dados() { return doc },
      async registrar(_i, r) { registros.push(r) },
    },
    certificados: { async obter() { return { chave: 'k', cadeia: 'c' } } },
    rnds: { async enviar(p) { chamadas.push(p); return { resultado: 'enviado', idRnds: p.excluir ?? 'novo', resposta: { status: 204 } } } },
  }
}

const envio = (extra: Partial<DocumentoCarregado['envio']> = {}): DocumentoCarregado['envio'] => ({
  ambiente: 'homologacao', uf: 'GO', identificador_solicitante: '99999', id_rnds_anterior: 'rnds-123',
  profissional_id: 'p', profissional_cns: '700000000000013', ...extra,
})

test('exclusão: o ciclo manda o DELETE do id RNDS do RIA enviado, sem montar documento', async () => {
  const registros: Registro[] = []
  const chamadas: { excluir?: string; bundle: unknown; cns: string }[] = []
  await processarLote(deps({ item_id: 'x', tipo: 'ria', dados: { acao: 'excluir' }, envio: envio() }, registros, chamadas as unknown[]))
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].excluir, 'rnds-123')
  assert.equal(chamadas[0].bundle, null)
  assert.equal(chamadas[0].cns, '700000000000013')
  assert.deepEqual(registros.map((r) => [r.resultado, r.idRnds]), [['enviado', 'rnds-123']])
})

test('exclusão sem o id RNDS do enviado é erro, sem chamar a RNDS', async () => {
  const registros: Registro[] = []
  const chamadas: unknown[] = []
  await processarLote(deps({ item_id: 'x', tipo: 'ria', dados: { acao: 'excluir' }, envio: envio({ id_rnds_anterior: null }) }, registros, chamadas))
  assert.equal(chamadas.length, 0)
  assert.equal(registros[0].resultado, 'erro')
})
