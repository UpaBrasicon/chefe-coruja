// node --experimental-strip-types --test src/lib/indicadoresRegulacao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { desdobramento, emOrdem, filtrosIndicadoresParaEnvio, linhasCsvIndicadores, plural, taxa, tempo, type Indicadores } from './indicadoresRegulacao.ts'

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

test('RC5: "0 min" no lugar de "agora", plural e ordem 1 → 4', () => {
  assert.equal(tempo(0), '0 min')
  assert.equal(tempo(59), '0 min')
  assert.equal(tempo(8 * 60), '8 min')
  assert.equal(plural(1, 'pedido'), '1 pedido')
  assert.equal(plural(3, 'pedido'), '3 pedidos')
  assert.deepEqual(emOrdem({ urgencia: 2, emergencia: 1, eletiva: 4 }).map(([k]) => k), ['emergencia', 'urgencia', 'eletiva'])
  const e = (n: number, m: number) => ({ n, mediana: m, p90: m })
  const linhas = desdobramento({
    decisao: { geral: e(3, 60), por_prioridade: [{ grupo: 'urgencia', ...e(2, 120) }, { grupo: 'emergencia', ...e(1, 0) }], por_tipo: [{ grupo: 'leito', ...e(3, 60) }] },
    aceite: { geral: e(1, 600), por_prioridade: [{ grupo: 'urgencia', ...e(1, 600) }], por_tipo: [] },
    chegada: { geral: null, por_prioridade: [], por_tipo: [] },
  })
  assert.deepEqual(linhas.map((l) => l.grupo), ['emergencia', 'urgencia', 'leito'])
  assert.equal(linhas[1].aceite?.mediana, 600)
  assert.equal(linhas[0].aceite, null)
})
