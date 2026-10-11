// node --experimental-strip-types --test src/lib/indicadoresRegulacao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filtrosIndicadoresParaEnvio, linhasCsvIndicadores, taxa, tempo, type Indicadores } from './indicadoresRegulacao.ts'

test('indicadores: taxa, tempo e filtros', () => {
  assert.equal(taxa(1, 3), '33%')
  assert.equal(taxa(0, 0), '—')
  assert.equal(tempo(null), '—')
  assert.equal(tempo(10800), '3 h 00 min')
  assert.deepEqual(filtrosIndicadoresParaEnvio({ de: '2026-10-01', ate: '2026-10-11', tipo: '', prioridade: 'urgencia' }),
    { de: '2026-10-01', ate: '2026-10-11', prioridade: 'urgencia' })
})

test('indicadores: linhas do CSV', () => {
  const vazio = { geral: null, por_prioridade: [], por_tipo: [] }
  const ind: Indicadores = {
    periodo: { de: '2026-10-01', ate: '2026-10-11' }, escopo: 'rede', total: 5,
    tempos: { decisao: { geral: { n: 2, mediana: 10800, p90: 13680 }, por_prioridade: [{ grupo: 'eletiva', n: 1, mediana: 14400, p90: 14400 }], por_tipo: [] },
      aceite: vazio, chegada: vazio },
    fila_atual: { por_tipo: {}, por_prioridade: {} },
    volume: { por_dia: [], por_tipo: {}, por_origem: [], por_destino: [] },
    desfechos: { autorizadas: 1, negadas: 1, devolvidas: 1, canceladas: 1, realizadas: 1, faltas: 0,
      negacao_por_motivo: { sem_oferta: 1 }, respostas_destino: 2, recusas_destino: 1, recusa_por_motivo: {} },
    prazos: { fila: { n: 2, no_prazo: 1 }, pendencia: { n: 0, no_prazo: 0 }, evolucao: { n: 0, no_prazo: 0 }, destino: { n: 0, no_prazo: 0 } },
    gargalos: { por_origem: [], por_destino: [], por_tipo_leito: [] },
  }
  const l = linhasCsvIndicadores(ind, { tempo: { decisao: 'Até a decisão' }, grupo: (g) => g.toUpperCase() })
  assert.deepEqual(l[0], ['Volume', 'Pedidos no período', '', 5])
  assert.deepEqual(l[1], ['Até a decisão', 'Mediana (min)', 'geral', 180])
  assert.ok(l.some((x) => x[1] === 'Mediana (min)' && x[2] === 'ELETIVA' && x[3] === 240))
  assert.ok(l.some((x) => x[1] === 'Negação por motivo' && x[2] === 'sem_oferta'))
  assert.ok(l.some((x) => x[0] === 'Prazos' && x[2] === 'fila' && x[1] === 'No prazo' && x[3] === 1))
})
