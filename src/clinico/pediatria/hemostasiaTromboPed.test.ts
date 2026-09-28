// node --experimental-strip-types --test src/clinico/pediatria/hemostasiaTromboPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { fatorVIIIUI } from './hemoterapiaPed.ts'
import {
  DOSES_HEMOSTASIA, DOSES_PTI, QUADRO2, ajusteHnf, ajusteVarfarina, enoxaparinaPorIdade, fichaHemostasiaTromboPed, hnfAtaqueUI, hnfManutencaoUIkgH, reposicaoQuadro2, rtpaMgH,
  varfarinaDia1Mg,
} from './hemostasiaTromboPed.ts'

test('Quadro 2: UI/kg × peso, coerente com Δ% ÷ 2 do fator VIII (p. 679–680)', () => {
  assert.equal(temReferenciaPediatrica(fichaHemostasiaTromboPed), true)
  const snc = QUADRO2.find((l) => l.id === 'snc')!
  assert.deepEqual(reposicaoQuadro2(snc, 'f8', 20), { inicial: [800, 1000], manutencao: [500, 500] })
  assert.deepEqual(reposicaoQuadro2(snc, 'f9', 20)!.inicial, [1200, 1600])
  // 80–100% de FVIII em 20 kg pela fórmula = 800–1.000 UI, igual ao quadro
  assert.equal(fatorVIIIUI(20, 80)!.dose, 800)
  assert.equal(reposicaoQuadro2(QUADRO2[0], 'f8', 0), null)
})

test('antifibrinolítico com teto de 2 g/dia e PTI (p. 679–684)', () => {
  const atx = calcularDoseLivro(DOSES_HEMOSTASIA.find((d) => d.id === 'atx-vo')!, 40)!
  assert.deepEqual(atx.porDose, [600, 800])
  assert.deepEqual(atx.dia, [1800, 2000])
  const mp = calcularDoseLivro(DOSES_PTI.find((d) => d.id === 'mp-pti')!, 40)!
  assert.deepEqual(mp.dia, [1000, 1000])
})

test('HNF: ataque, manutenção por idade e nomograma do TTPa (p. 690)', () => {
  assert.deepEqual(hnfAtaqueUI(10), [750, 750])
  assert.equal(hnfManutencaoUIkgH(6), 28)
  assert.equal(hnfManutencaoUIkgH(12), 'indefinido')
  assert.equal(hnfManutencaoUIkgH(24), 20)
  assert.deepEqual(ajusteHnf(45), { bolusUIkg: 50, pausaMin: 0, ajustePct: 10, repetirTtpa: '4 h' })
  assert.equal(ajusteHnf(59)!.ajustePct, 10)
  assert.equal(ajusteHnf(85)!.repetirTtpa, '24 h')
  assert.equal(ajusteHnf(100)!.pausaMin, 30)
  assert.equal(ajusteHnf(130)!.ajustePct, -15)
})

test('enoxaparina, varfarina e rt-PA (p. 690–691)', () => {
  assert.deepEqual(enoxaparinaPorIdade(1), { terapeutica12h: [1.5, 1.75], profilatica12h: 0.75, profilatica24h: 1.5 })
  assert.equal(enoxaparinaPorIdade(2), 'indefinido')
  assert.equal(varfarinaDia1Mg(10), 2)
  assert.equal(varfarinaDia1Mg(40), 5)
  assert.equal(ajusteVarfarina(1.2, 'd2-4'), 'Repetir a dose inicial')
  assert.equal(ajusteVarfarina(2.5, 'd5+'), 'Sem alteração')
  assert.match(ajusteVarfarina(4, 'd5+')!, /20%/)
  assert.deepEqual(rtpaMgH(10), [1, 6])
})
