// node --experimental-strip-types --test src/lib/examesLeito.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agruparExames, atrasado, exameCabeParaSexo, idadePedido, pedidoEm, type ExameLinha } from './examesLeito.ts'

const agora = Date.parse('2026-11-24T12:00:00Z')
const ex = (id: string, exame: string, situacao: string, horasAtras: number, resultado: string | null = null): ExameLinha => ({
  id, exame, situacao, resultado, motivo_cancelamento: situacao === 'cancelado' ? 'paciente recusou' : null,
  pedido_em: new Date(agora - horasAtras * 3600_000).toISOString(), procedimento: null, urgencia: 'rotina', critico: false, resultado_visto_em: null,
})

test('repetidos aguardando viram uma linha com a contagem e a idade do mais antigo', () => {
  const g = agruparExames([ex('1', 'Hemograma completo', 'pedido', 10), ex('2', 'hemograma completo', 'pedido', 700), ex('3', 'PCR', 'coletado', 2)], agora)
  assert.equal(g.aguardando.length, 2)
  const hemo = g.aguardando.find((x) => x.e.exame.toLowerCase().startsWith('hemo'))!
  assert.equal(hemo.vezes, 2)
  assert.equal(hemo.horas, 700)
  assert.ok(atrasado(hemo.horas))
})

test('resultado traz o anterior do mesmo exame para comparar, cru', () => {
  const g = agruparExames([ex('1', 'Potássio', 'resultado', 5, '5,8'), ex('2', 'Potássio', 'resultado', 30, '4,1'), ex('3', 'Sódio', 'resultado', 5, '138')], agora)
  const k = g.comResultado.find((x) => x.e.id === '1')!
  assert.deepEqual(k.anterior?.resultado, '4,1')
  assert.equal(g.comResultado.find((x) => x.e.id === '2')!.anterior, null)
})

test('cancelados ficam à parte', () => {
  const g = agruparExames([ex('1', 'TGO', 'cancelado', 1), ex('2', 'TGO', 'pedido', 1)], agora)
  assert.equal(g.cancelados.length, 1)
  assert.equal(g.aguardando.length, 1)
})

test('idade do pedido legível', () => {
  assert.equal(idadePedido(0), 'há menos de 1 h')
  assert.equal(idadePedido(5), 'há 5 h')
  assert.equal(idadePedido(72), 'há 3 dias')
})

test('citopatológico só para sexo feminino', () => {
  assert.equal(exameCabeParaSexo('citopatologia', 'M'), false)
  assert.equal(exameCabeParaSexo('citopatologia', 'F'), true)
  assert.equal(exameCabeParaSexo('laboratorio', 'M'), true)
})

test('já pedido mostra a data do pedido mais recente', () => {
  const p = [{ exame: 'Hemograma completo', procedimento: null, situacao: 'pedido', pedido_em: '2026-10-27T10:00:00Z' },
    { exame: 'Hemograma completo', procedimento: null, situacao: 'cancelado', pedido_em: '2026-11-20T10:00:00Z' }]
  assert.equal(pedidoEm({ rotulo: 'Hemograma completo', procedimento: null }, p), '2026-10-27T10:00:00Z')
  assert.equal(pedidoEm({ rotulo: 'PCR', procedimento: null }, p), null)
})
