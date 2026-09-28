import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  DROGAS_ASMA, DROGAS_DPOC, classificarDpoc, cicloVentilatorio, fichaAsmaAdulto, fichaDpocAdulto, infusaoMgAsma, lerGasometriaDpoc,
  mgBeta2, percentualPredito, posicaoTabela1, posicionarAsma, suporteVni, vcDpoc,
} from './asmaDpoc.ts'

test('asma/DPOC: fichas adulto dos caps. 30 e 31, sem referência pediátrica', () => {
  for (const f of [fichaAsmaAdulto, fichaDpocAdulto]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('asma Tabela 1 (p. 408): cortes de FC, pulso paradoxal e VEF1', () => {
  assert.deepEqual(posicaoTabela1('fc', 99)!.colunas, ['leve'])
  assert.deepEqual(posicaoTabela1('fc', 100)!.colunas, ['moderada'])
  assert.deepEqual(posicaoTabela1('fc', 120)!.colunas, ['moderada'])
  assert.deepEqual(posicaoTabela1('fc', 121)!.colunas, ['grave'])
  assert.deepEqual(posicaoTabela1('pulsoParadoxal', 25)!.colunas, ['moderada'])
  assert.deepEqual(posicaoTabela1('pulsoParadoxal', 26)!.colunas, ['grave'])
  assert.deepEqual(posicaoTabela1('vef1', 81)!.colunas, ['leve'])
  assert.deepEqual(posicaoTabela1('vef1', 60)!.colunas, ['moderada'])
  assert.deepEqual(posicaoTabela1('vef1', 59)!.colunas, ['grave'])
  assert.deepEqual(posicaoTabela1('fr', 31)!.colunas, ['grave'])
  assert.deepEqual(posicaoTabela1('fr', 30)!.colunas, ['leve', 'moderada'])
})

test('asma Tabela 1: lacunas do livro ficam sem coluna (SaO2 90–91, PaO2 60, PaCO2 45)', () => {
  assert.deepEqual(posicaoTabela1('sao2', 96)!.colunas, ['leve'])
  assert.deepEqual(posicaoTabela1('sao2', 91)!.colunas, ['moderada'])
  assert.deepEqual(posicaoTabela1('sao2', 90)!.colunas, [])
  assert.deepEqual(posicaoTabela1('sao2', 89)!.colunas, ['grave'])
  assert.deepEqual(posicaoTabela1('pao2', 60)!.colunas, [])
  assert.deepEqual(posicaoTabela1('paco2', 45)!.colunas, [])
  assert.deepEqual(posicaoTabela1('paco2', 46)!.colunas, ['grave'])
  assert.equal(posicaoTabela1('fc', Number.NaN), null)
})

test('asma: coluna mais à direita atingida só conta parâmetros de coluna única', () => {
  assert.equal(posicionarAsma({ fc: 110, sao2: 93 }).maisGrave, 'moderada')
  assert.equal(posicionarAsma({ fc: 110, paco2: 50 }).maisGrave, 'grave')
  assert.equal(posicionarAsma({ paco2: 40 }).maisGrave, null)
  assert.equal(posicionarAsma({}).itens.length, 0)
  assert.equal(percentualPredito(250, 500), 50)
})

test('β2: 10–20 gotas = 2,5–5 mg (p. 423)', () => {
  assert.equal(mgBeta2(10), 2.5)
  assert.equal(mgBeta2(20), 5)
  assert.ok(DROGAS_ASMA.find((d) => d.id === 'beta2-spray')!.texto.includes('4–8 jatos'))
  assert.ok(DROGAS_DPOC.find((d) => d.id === 'prednisona')!.texto.includes('40 mg'))
})

test('MgSO4 na asma: 1,2–2 g em 100–500 mL em 20 min (p. 413); 1 g = 10 mL de 10% = 8 mEq (p. 1501)', () => {
  assert.deepEqual(infusaoMgAsma(2, 100), { gramas: 2, mlMgSO4_10: 20, mEq: 16, volumeTotalMl: 120, mlH: 360, foraDaFaixa: false })
  assert.equal(infusaoMgAsma(1.2, 100)!.mlMgSO4_10, 12)
  assert.equal(infusaoMgAsma(3, 100)!.foraDaFaixa, true)
  assert.equal(infusaoMgAsma(0, 100), null)
})

test('DPOC: 1/2/3 sintomas cardinais = leve/moderada/grave (Tabela 1, p. 418)', () => {
  assert.equal(classificarDpoc(1)!.classe, 'leve')
  assert.equal(classificarDpoc(2)!.classe, 'moderada')
  assert.equal(classificarDpoc(3)!.classe, 'grave')
  assert.equal(classificarDpoc(0), null)
})

test('DPOC: cortes gasométricos (p. 422, Tabela 6 p. 424, Tabela 9 p. 426)', () => {
  const g = lerGasometriaDpoc({ pao2: 45, paco2: 75, ph: 7.22 })
  assert.deepEqual(g.irpa, ['PaO2 < 60 mmHg', 'PaCO2 > 50 mmHg'])
  assert.deepEqual(g.granGravidade, ['PaO2 < 50 mmHg', 'PaCO2 > 70 mmHg', 'pH < 7,3'])
  assert.equal(g.vni.length, 1)
  assert.deepEqual(g.uti, ['pH < 7,25'])
  const n = lerGasometriaDpoc({ pao2: 70, paco2: 45, ph: 7.38 })
  assert.deepEqual([n.irpa, n.granGravidade, n.vni, n.uti], [[], [], [], []])
  assert.equal(lerGasometriaDpoc({ ph: 7.3, paco2: 60 }).vni.length, 0) // PaCO2 > 60 estrito
})

test('DPOC: VNI IPAP 8–12 / EPAP 3–5 (p. 424); VM VC 5–6 mL/kg (p. 425)', () => {
  assert.deepEqual(suporteVni(), [3, 9])
  assert.deepEqual(vcDpoc(70), [350, 420])
  assert.equal(vcDpoc(0), null)
})

test('ciclo ventilatório: FR 10 com I:E 1:3 → ciclo 6 s, Ti 1,5 s, Te 4,5 s', () => {
  assert.deepEqual(cicloVentilatorio(10, 1, 3), { cicloS: 6, tiS: 1.5, teS: 4.5 })
  assert.equal(cicloVentilatorio(0, 1, 3), null)
})
