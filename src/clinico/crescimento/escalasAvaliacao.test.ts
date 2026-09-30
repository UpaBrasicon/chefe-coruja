import assert from 'node:assert/strict'
import { test } from 'node:test'

import { temReferenciaPediatrica } from '../ficha.ts'
import { ESCALAS_AVALIACAO, escalasDoPublico, faixaDe, respondidas, totalAvaliacao } from './escalasAvaliacao.ts'

test('pediatria só com escala de fonte pediátrica; adulto só com as de adulto', () => {
  assert.deepEqual(escalasDoPublico('pediatrico'), ['nips', 'flacc'])
  assert.deepEqual(escalasDoPublico('adulto'), ['braden', 'morse'])
  assert.deepEqual(escalasDoPublico(null), [])
  for (const e of escalasDoPublico('pediatrico')) assert.ok(temReferenciaPediatrica(ESCALAS_AVALIACAO[e].ficha), e)
  for (const e of escalasDoPublico('adulto')) assert.equal(ESCALAS_AVALIACAO[e].ficha.publico, 'adulto', e)
  assert.ok(!('fugulin' in ESCALAS_AVALIACAO), 'Fugulin fica fora até a unidade dizer a versão')
})

test('soma só com todas as respostas e valores das opções', () => {
  assert.equal(totalAvaliacao('nips', { face: 1, choro: 2, resp: 1, bracos: 0, pernas: 0 }), null)
  assert.equal(totalAvaliacao('nips', { face: 1, choro: 2, resp: 1, bracos: 0, pernas: 0, alerta: 1 }), 5)
  assert.equal(totalAvaliacao('nips', { face: 3, choro: 2, resp: 1, bracos: 0, pernas: 0, alerta: 1 }), null)
  assert.equal(respondidas('nips', { face: 1 }), 1)
  const braden = { percepcao: 1, umidade: 1, atividade: 1, mobilidade: 1, nutricao: 1, friccao: 1 }
  assert.equal(totalAvaliacao('braden', braden), 6)
  assert.equal(totalAvaliacao('braden', { ...braden, percepcao: 4, umidade: 4, atividade: 4, mobilidade: 4, nutricao: 4, friccao: 3 }), 23)
  assert.equal(totalAvaliacao('morse', { quedas: 25, diagnostico: 15, auxilio: 30, terapia_ev: 20, marcha: 20, estado_mental: 15 }), 125)
})

test('interpretação pela faixa da própria escala (limites)', () => {
  assert.equal(faixaDe('nips', 3).rotulo, 'Sem dor pela NIPS (0 a 3)')
  assert.equal(faixaDe('nips', 4).rotulo, 'Dor (4 ou mais)')
  assert.equal(faixaDe('flacc', 0).rotulo, 'Relaxado e confortável (0)')
  assert.equal(faixaDe('flacc', 3).rotulo, 'Desconforto leve (1 a 3)')
  assert.equal(faixaDe('flacc', 7).rotulo, 'Dor intensa (7 a 10)')
  assert.equal(faixaDe('braden', 9).rotulo, 'Risco muito alto (9 ou menos)')
  assert.equal(faixaDe('braden', 12).rotulo, 'Risco alto (10 a 12)')
  assert.equal(faixaDe('braden', 18).rotulo, 'Risco baixo (15 a 18)')
  assert.equal(faixaDe('braden', 19).rotulo, 'Sem risco (19 a 23)')
  assert.equal(faixaDe('morse', 24).rotulo, 'Risco baixo (0 a 24)')
  assert.equal(faixaDe('morse', 45).rotulo, 'Risco alto (45 ou mais)')
})

test('máximos: NIPS 7, FLACC 10', () => {
  const max = (e: 'nips' | 'flacc') => ESCALAS_AVALIACAO[e].itens.reduce((s, it) => s + Math.max(...it.opcoes.map((o) => o.valor)), 0)
  assert.equal(max('nips'), 7)
  assert.equal(max('flacc'), 10)
})
