import assert from 'node:assert/strict'
import { test } from 'node:test'

import { idadeParaFerramenta, pesoParaFerramenta } from './pacienteDoAtendimento.ts'

// F3 das ferramentas pelo CID: regra do peso velho (RT, 17/11/2026: criança
// mais de 24 h, adulto mais de 7 dias) e a idade levada à Central.
const agora = new Date('2026-11-17T12:00:00-03:00')
const horasAtras = (h: number) => new Date(agora.getTime() - h * 3_600_000).toISOString()

test('criança: peso de até 24 h vai com a origem; mais velho, não', () => {
  const ok = pesoParaFerramenta({ valor_num: 18.5, aferido_em: horasAtras(23) }, 'pediatrico', agora)
  assert.equal(ok.kg, 18.5)
  assert.match('origem' in ok ? ok.origem : '', /^peso do prontuário, \d{2}\/\d{2}$/)
  const velho = pesoParaFerramenta({ valor_num: 18.5, aferido_em: horasAtras(25) }, 'pediatrico', agora)
  assert.equal(velho.kg, null)
  assert.match('motivo' in velho ? velho.motivo : '', /mais de 24 h/)
})

test('adulto: até 7 dias vai; mais de 7 dias, não', () => {
  assert.equal(pesoParaFerramenta({ valor_num: 72, aferido_em: horasAtras(24 * 6) }, 'adulto', agora).kg, 72)
  assert.equal(pesoParaFerramenta({ valor_num: 72, aferido_em: horasAtras(24 * 8) }, 'adulto', agora).kg, null)
})

test('sem idade conhecida vale o prazo da criança; sem peso, peso zero ou data no futuro, nada vai', () => {
  assert.equal(pesoParaFerramenta({ valor_num: 60, aferido_em: horasAtras(30) }, 'desconhecida', agora).kg, null)
  assert.equal(pesoParaFerramenta(null, 'adulto', agora).kg, null)
  assert.equal(pesoParaFerramenta({ valor_num: 0, aferido_em: horasAtras(1) }, 'adulto', agora).kg, null)
  assert.equal(pesoParaFerramenta({ valor_num: 70, aferido_em: horasAtras(-2) }, 'adulto', agora).kg, null)
})

test('idade: abaixo de 2 anos em meses; depois em anos completos; sem nascimento, nada', () => {
  assert.deepEqual(idadeParaFerramenta('2025-05-10', agora), { valor: 18, unidade: 'meses', rotulo: '18 meses' })
  assert.deepEqual(idadeParaFerramenta('2012-11-18', agora), { valor: 13, unidade: 'anos', rotulo: '13 anos' })
  assert.equal(idadeParaFerramenta(null, agora), null)
})
