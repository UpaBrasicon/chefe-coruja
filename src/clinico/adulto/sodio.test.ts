import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  CONDUTA_HIPONATREMIA, ERRATA_ADROGUE, ERRATA_HIPONATREMIA, ERRATA_SODIO_CORRIGIDO, LIMITES_HIPERNATREMIA, LIMITES_HIPONATREMIA, SALINA_3,
  SOLUCOES_HIPERNATREMIA, aguaCorporalTotal, concentracaoPreparoSalina3, deficitAguaLivre, elevacaoEstimadaSalina3, fatorAguaCorporal, fichaHipernatremia,
  fichaHiponatremia, gravidadeHiponatremia, litrosParaDeficit, litrosParaReducao, mlSalina3ParaElevar, sodioCorrigido, tonicidade, variacaoPorLitro,
} from './sodio.ts'

const r1 = (x: number | null) => Math.round(x! * 10) / 10
const sol = (id: string) => SOLUCOES_HIPERNATREMIA.find((s) => s.id === id)!

test('sódio: fichas do manual HCFMUSP, adulto, ids distintos', () => {
  for (const f of [fichaHiponatremia, fichaHipernatremia]) {
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência/)
    assert.equal(f.publico, 'adulto')
    assert.equal(temReferenciaPediatrica(f), false)
    assert.match(f.id, /^adulto-/)
  }
  assert.notEqual(fichaHiponatremia.id, fichaHipernatremia.id)
})

test('sódio corrigido: +1,6 a cada 100 mg/dL acima de 100 (p. 883/886/896), não a fórmula impressa na p. 869', () => {
  assert.equal(sodioCorrigido(130, 100), 130)
  assert.equal(r1(sodioCorrigido(130, 200)), 131.6)
  assert.equal(r1(sodioCorrigido(125, 600)), 133)
  assert.equal(sodioCorrigido(140, 80), 140) // sem correção abaixo de 100
  // a fórmula literal da p. 869 daria 125 + 1,6 × 600 − 100 = 985
  assert.ok(sodioCorrigido(125, 600)! < 200)
  assert.match(ERRATA_SODIO_CORRIGIDO, /p\. 869/)
  assert.equal(sodioCorrigido(0, 200), null)
})

test('hiponatremia: tonicidade e gravidade nos cortes do livro (p. 883, 888)', () => {
  assert.equal(tonicidade(296), 'hipertonica')
  assert.equal(tonicidade(295), 'isotonica')
  assert.equal(tonicidade(280), 'isotonica')
  assert.equal(tonicidade(279), 'hipotonica')
  assert.equal(gravidadeHiponatremia(135), null)
  assert.equal(gravidadeHiponatremia(134), 'leve')
  assert.equal(gravidadeHiponatremia(130), 'leve')
  assert.equal(gravidadeHiponatremia(129), 'moderada')
  assert.equal(gravidadeHiponatremia(120), 'moderada')
  assert.equal(gravidadeHiponatremia(119), 'grave')
})

test('NaCl 3%: o preparo do livro (445 mL SF + 55 mL NaCl 20%) fecha em 3% e 500 mL (p. 889)', () => {
  assert.equal(SALINA_3.sfMl + SALINA_3.nacl20Ml, SALINA_3.totalMl)
  assert.equal(Math.round(concentracaoPreparoSalina3() * 100) / 100, 3)
})

test('NaCl 3%: 1 mL/kg ≈ +1 mEq/L (p. 889) e limites da Tabela 5', () => {
  assert.equal(mlSalina3ParaElevar(70, 6), 420)
  assert.equal(elevacaoEstimadaSalina3(70, 420), 6)
  // 15–30 mL/h por 24 h num adulto de 70 kg: 360–720 mL → ~5,1–10,3 mEq/L (o teto de 8 mEq/L pode ser passado)
  assert.equal(r1(elevacaoEstimadaSalina3(70, 15 * 24)), 5.1)
  assert.equal(r1(elevacaoEstimadaSalina3(70, 30 * 24)), 10.3)
  assert.equal(LIMITES_HIPONATREMIA.cronicaMax24h, 8)
  assert.equal(LIMITES_HIPONATREMIA.pararEm, 125)
  assert.equal(LIMITES_HIPONATREMIA.bolusMaxMl, 300)
  assert.equal(mlSalina3ParaElevar(0, 6), null)
  assert.equal(mlSalina3ParaElevar(70, -1), null)
})

test('hiponatremia: errata do "20%" da p. 889 registrada; tabelas usam NaCl 3%', () => {
  assert.match(ERRATA_HIPONATREMIA, /20%/)
  for (const l of Object.values(CONDUTA_HIPONATREMIA)) {
    assert.ok(l.pagina.includes('p. 8'), l.cenario)
    assert.ok(!l.manual.join(' ').includes('20%'), l.cenario)
  }
})

test('hipernatremia: ACT por sexo e idade (p. 897)', () => {
  assert.equal(fatorAguaCorporal('masculino', false), 0.6)
  assert.equal(fatorAguaCorporal('feminino', false), 0.5)
  assert.equal(fatorAguaCorporal('masculino', true), 0.5)
  assert.equal(fatorAguaCorporal('feminino', true), 0.45)
  assert.equal(aguaCorporalTotal(70, 'masculino', false), 42)
})

test('hipernatremia: exemplo do livro — 1 L de G5%, homem 70 kg, Na 160 → queda de 3,7 mEq/L (p. 898)', () => {
  const act = aguaCorporalTotal(70, 'masculino', false)!
  assert.equal(r1(variacaoPorLitro(160, sol('g5').naMeqL, act)), 3.7)
  // a leitura literal da fórmula impressa (160/42 + 1) daria 4,8 — errata
  assert.notEqual(r1(160 / act + 1), 3.7)
  assert.match(ERRATA_ADROGUE, /3,7/)
})

test('hipernatremia: déficit de água livre e volumes (p. 897–898)', () => {
  const act = aguaCorporalTotal(70, 'masculino', false)!
  const def = deficitAguaLivre(160, act)!
  assert.equal(r1(def), 6)
  assert.equal(r1(litrosParaDeficit(def, sol('g5'))), 6)
  assert.equal(r1(litrosParaDeficit(def, sol('sal045'))), 12)
  assert.equal(r1(litrosParaDeficit(def, sol('sal0225'))), 8)
  assert.equal(litrosParaDeficit(def, sol('sf')), null)
  // 0,45% (77 mEq/L): (160 − 77)/43 ≈ 1,93 por litro; 8 mEq/L → ~4,1 L
  const porL = variacaoPorLitro(160, 77, act)!
  assert.equal(r1(porL), 1.9)
  assert.equal(r1(litrosParaReducao(8, porL)), 4.1)
  assert.equal(litrosParaReducao(8, 0), null)
})

test('hipernatremia: limites de velocidade do livro (p. 898)', () => {
  assert.deepEqual(LIMITES_HIPERNATREMIA.cronicaMax24h, [8, 10])
  assert.equal(LIMITES_HIPERNATREMIA.agudaPorHora, 1)
  assert.deepEqual(LIMITES_HIPERNATREMIA.agudaHoras, [6, 8])
  assert.deepEqual(SOLUCOES_HIPERNATREMIA.map((s) => s.naMeqL), [0, 77, 38, 154])
})
