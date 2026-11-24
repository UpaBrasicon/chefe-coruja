// node --experimental-strip-types --test src/lib/portaFila.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agruparPorEtapa, faixaDaFila } from './portaFila.ts'
import type { Porta } from './portaAgora.ts'

const etapas = (e: Partial<Porta['etapas']>): Pick<Porta, 'etapas'> => ({
  etapas: {
    triagem: { n: 0 }, aguardando_medico: { n: 0, fora_alvo: 0 }, em_atendimento: { n: 0 },
    medicacao_pendente: { n: 0 }, observacao: { n: 0, acima_6h: 0 }, altas_hoje: { n: 0 }, ...e,
  },
})

test('faixa: as quatro etapas do caminho, com a parte de cada uma e os atrasados', () => {
  const f = faixaDaFila(etapas({
    triagem: { n: 2, espera_max_min: 30 }, aguardando_medico: { n: 4, fora_alvo: 1 }, em_atendimento: { n: 2 },
    observacao: { n: 0, acima_6h: 0 }, medicacao_pendente: { n: 9 }, altas_hoje: { n: 7 },
  }))
  assert.deepEqual(f.map((s) => s.chave), ['triagem', 'aguardando_medico', 'em_atendimento', 'observacao'])
  assert.equal(f[1].parte, 0.5)
  assert.equal(f[1].atrasados, 1)
  assert.equal(f[0].esperaMaxMin, 30)
  assert.equal(f[3].parte, 0)
})

test('faixa vazia: nenhuma parte, sem dividir por zero', () => {
  assert.ok(faixaDaFila(etapas({})).every((s) => s.parte === 0))
})

test('grupos por etapa: na ordem do caminho, fora do alvo primeiro, grupo vazio some', () => {
  const g = agruparPorEtapa([
    { etapa: 'aguardando_medico' as const, fora_alvo: false, espera_min: 50 },
    { etapa: 'triagem' as const, fora_alvo: false, espera_min: 5 },
    { etapa: 'aguardando_medico' as const, fora_alvo: true, espera_min: 20 },
    { etapa: 'aguardando_medico' as const, fora_alvo: false, espera_min: 90 },
  ])
  assert.deepEqual(g.map((x) => x.chave), ['triagem', 'aguardando_medico'])
  assert.deepEqual(g[1].pacientes.map((p) => p.espera_min), [20, 90, 50])
})
