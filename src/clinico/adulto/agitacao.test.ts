import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  CONTENCAO_QUIMICA, DELIRIUM_TABELA7, bars, contaSnm, fichaAgitacaoAdulto, metadeDaDose, quetaminaAgitacao, restanteAteMaxima, shockIndex,
} from './agitacao.ts'

test('agitação: fichas de adulto, sem referência pediátrica', () => {
  for (const f of [fichaAgitacaoAdulto, bars.ficha]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
  assert.match(bars.ficha.fontes[0].citacao, /p\. 1005–1006/)
})

test('BARS: 7 níveis com a triagem da Tabela 1 (p. 1006)', () => {
  assert.equal(bars.calcular({}), null)
  const quieto = bars.calcular({ nivel: 3 })!
  assert.equal(quieto.valor, '4')
  assert.equal(quieto.estado, 0)
  assert.deepEqual(quieto.derivados[0], ['Triagem pré-hospitalar da Tabela 1 (p. 1006)', 'Sem condutas'])
  const violento = bars.calcular({ nivel: 6 })!
  assert.equal(violento.valor, '7')
  assert.equal(violento.estado, 2)
  assert.match(violento.derivados[0][1], /Transferência para o departamento/)
})

test('contenção química: Tabela 4 por nível (p. 1011)', () => {
  assert.deepEqual(CONTENCAO_QUIMICA.map((c) => c.escolha), ['Lorazepam 1-2 mg SL', 'Midazolam 2-5 mg IM', 'Quetamina 5 mg/kg IM'])
})

test('quetamina na agitação: 5 mg/kg IM (tabela), 4-6 IM e 1-2 IV (texto) (p. 1011)', () => {
  assert.deepEqual(quetaminaAgitacao(70), { tabelaImMg: 350, imMg: [280, 420], ivMg: [70, 140] })
  assert.equal(quetaminaAgitacao(0), null)
  assert.deepEqual(metadeDaDose([5, 10]), [2.5, 5])
})

test('shock index > 0,7 (Tabela 5, p. 1013)', () => {
  assert.deepEqual(shockIndex(84, 120), { valor: 0.7, acimaDoCorte: false })
  assert.equal(shockIndex(100, 100)!.acimaDoCorte, true)
  assert.equal(shockIndex(0, 100), null)
})

test('delirium: Tabela 7 e soma até a máxima (p. 136–137)', () => {
  const halo = DELIRIUM_TABELA7.find((d) => d.id === 'haloperidol')!
  assert.deepEqual([halo.inicialMg, halo.maximaMg], [[0.25, 0.5], 3])
  assert.equal(DELIRIUM_TABELA7.find((d) => d.id === 'olanzapina')!.maximaMg, 20)
  assert.deepEqual(restanteAteMaxima(3, [0.5, 0.5, 1]), { somaMg: 2, restanteMg: 1, atingiu: false })
  assert.equal(restanteAteMaxima(3, [2, 1.5])!.atingiu, true)
  assert.equal(restanteAteMaxima(3, [-1]), null)
})

test('SNM: dantroleno até 10 mg/kg/dia em doses de 50 mg; 3-4 L/dia (p. 1016)', () => {
  const c = contaSnm(70)!
  assert.equal(c.dantrolenoMaxMgDia, 700)
  assert.equal(c.dosesDe50AteMax, 14)
  assert.deepEqual(c.volumeMlH.map((x) => Math.round(x)), [125, 167])
  assert.equal(contaSnm(-5), null)
})
