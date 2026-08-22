// Testes do relatório semanal do Gavião — agregação pura (M6).
// montarResumo é separada do I/O para ser testável sem rede.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarResumo, type LinhaIncidente, type LinhaAlerta } from './relatorio.js'

const inicio = '2026-08-16T00:00:00.000Z'
const fim = '2026-08-23T00:00:00.000Z'

function incidente(over: Partial<LinhaIncidente>): LinhaIncidente {
  return {
    id: 'i-1',
    patrulha: 'dados',
    severidade: 'atencao',
    titulo: 'X',
    status: 'aberto',
    quando: '2026-08-20T10:00:00.000Z',
    ...over,
  }
}

function alerta(over: Partial<LinhaAlerta>): LinhaAlerta {
  return {
    id: 'a-1',
    unidade_id: 'u1',
    metrica: 'repasses',
    valor: 9,
    status: 'novo',
    quando: '2026-08-20T10:00:00.000Z',
    ...over,
  }
}

test('montarResumo — vazio retorna zeros e período', () => {
  const r = montarResumo([], [], inicio, fim)
  assert.equal(r.total_incidentes, 0)
  assert.equal(r.total_alertas, 0)
  assert.deepEqual(r.incidentes_por_severidade, { critico: 0, atencao: 0, informativo: 0 })
  assert.deepEqual(r.periodo, { inicio: '2026-08-16', fim: '2026-08-23' })
})

test('montarResumo — conta por severidade e patrulha', () => {
  const r = montarResumo(
    [
      incidente({ severidade: 'critico', patrulha: 'hermes' }),
      incidente({ severidade: 'atencao', patrulha: 'dados' }),
      incidente({ severidade: 'atencao', patrulha: 'dados' }),
      incidente({ severidade: 'informativo', patrulha: 'conteudo' }),
    ],
    [],
    inicio,
    fim
  )
  assert.equal(r.total_incidentes, 4)
  assert.deepEqual(r.incidentes_por_severidade, { critico: 1, atencao: 2, informativo: 1 })
  assert.deepEqual(r.incidentes_por_patrulha, { dados: 2, conteudo: 1, hermes: 1 })
})

test('montarResumo — conta alertas por status', () => {
  const r = montarResumo(
    [],
    [alerta({ status: 'novo' }), alerta({ status: 'novo' }), alerta({ status: 'justificado' })],
    inicio,
    fim
  )
  assert.equal(r.total_alertas, 3)
  assert.deepEqual(r.alertas_por_status, {
    novo: 2,
    visto: 0,
    em_acompanhamento: 0,
    justificado: 1,
  })
})

test('montarResumo — patrulha/status desconhecidos não quebram (soma não contabilizada)', () => {
  const r = montarResumo([incidente({ patrulha: 'desconhecida' })], [alerta({ status: 'x' })], inicio, fim)
  assert.equal(r.total_incidentes, 1)
  assert.equal(r.total_alertas, 1)
  // desconhecida não entra em nenhum bucket — total segue correto
  assert.deepEqual(r.incidentes_por_patrulha, { dados: 0, conteudo: 0, hermes: 0 })
})
