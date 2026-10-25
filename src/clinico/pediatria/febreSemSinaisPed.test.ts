// node --experimental-strip-types --test src/clinico/pediatria/febreSemSinaisPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  AAP_FEBRIL_2021, DOSES_FSSL, KAS_AAP_2021, PECARN_FEBRIL_2019, coletaUrina, faixaAap2021, faixaFssl, fichaFebreSemSinais, leucogramaAlterado, marcadoresAap2021, pcrAlterada, pecarn2019,
} from './febreSemSinaisPed.ts'

const d = (id: string) => DOSES_FSSL.find((x) => x.id === id)!

test('faixas dos fluxogramas (Figuras 1–3)', () => {
  assert.equal(temReferenciaPediatrica(fichaFebreSemSinais), true)
  assert.equal(faixaFssl(21, 0), '0-21d')
  assert.equal(faixaFssl(22, 0), '22-60d')
  assert.equal(faixaFssl(61, 0), '61-90d')
  assert.equal(faixaFssl(90, 0), '61-90d')
  assert.equal(faixaFssl(0, 3), '3-24m')
  assert.equal(faixaFssl(0, 24), '3-24m')
  assert.equal(faixaFssl(0, 25), 'fora')
  assert.equal(faixaFssl(0, 0), null)
})

test('leucograma e PCR (p. 463–467)', () => {
  assert.equal(leucogramaAlterado({ leucocitos: 0, neutrofilos: 0, bastoesSobreNeutrofilos: 0 }, false), null)
  assert.equal(leucogramaAlterado({ leucocitos: 15_000, neutrofilos: 0, bastoesSobreNeutrofilos: 0 }, false)!.alterado, true)
  assert.equal(leucogramaAlterado({ leucocitos: 12_000, neutrofilos: 5_000, bastoesSobreNeutrofilos: 0.1 }, false)!.alterado, false)
  assert.equal(leucogramaAlterado({ leucocitos: 12_000, neutrofilos: 5_000, bastoesSobreNeutrofilos: 0.1 }, true)!.alterado, true)
  assert.equal(pcrAlterada(20), false)
  assert.equal(pcrAlterada(21), true)
})

test('coleta de urina (p. 462)', () => {
  assert.equal(coletaUrina('menina', new Set(['t39', 'branca']), 10, false), 'coletar')
  assert.equal(coletaUrina('menina', new Set(['t39']), 10, false), 'nao-indicada')
  assert.equal(coletaUrina('menino', new Set(['t39']), 4, true), 'coletar')
  assert.equal(coletaUrina('menino', new Set(['t39']), 6, true), 'indefinido')
  assert.equal(coletaUrina('menino', new Set(['t39', 'semFoco']), 12, true), 'nao-indicada')
  assert.equal(coletaUrina('menino', new Set(['t39', 'semFoco']), 12, false), 'coletar')
})

test('doses (cap. 45 e Apêndice)', () => {
  assert.deepEqual(calcularDoseLivro(d('amoxicilina'), 10)!.dia, [500, 900])
  assert.deepEqual(calcularDoseLivro(d('cefuroxima-vo'), 40)!.porDose, [400, 500])
  assert.deepEqual(calcularDoseLivro(d('amoxclav-7'), 50)!.dia, [1250, 1750])
  assert.equal(d('ceftriaxona').neonatal, undefined)
})

// ── AAP 2021 e PECARN 2019 (lacunas da Central, lote 3) ──

test('febre: ficha .1 com AAP 2021 e PECARN 2019 depois do livro', () => {
  assert.equal(fichaFebreSemSinais.versao, '2026-10-25.1')
  assert.deepEqual(fichaFebreSemSinais.fontes.slice(-2), [AAP_FEBRIL_2021, PECARN_FEBRIL_2019])
  assert.equal(temReferenciaPediatrica(fichaFebreSemSinais), true)
})
test('AAP 2021: faixas 8–21, 22–28 e 29–60 dias; fora delas não se aplica', () => {
  assert.equal(faixaAap2021(7), null)
  assert.equal(faixaAap2021(8), '8-21')
  assert.equal(faixaAap2021(22), '22-28')
  assert.equal(faixaAap2021(29), '29-60')
  assert.equal(faixaAap2021(61), null)
})
test('AAP 2021: marcadores (procalcitonina > 0,5; PCR > 20; neutrófilos > 5.200; faixa 4.000–5.200 à parte)', () => {
  const r = marcadoresAap2021('29-60', { procalcitonina: 0.6, pcrMgL: 15, neutrofilos: 4500 })
  assert.deepEqual(r.alterados, ['procalcitonina > 0,5 ng/mL'])
  assert.equal(r.neutrofilosNaFaixa, true)
  assert.deepEqual(marcadoresAap2021('8-21', { neutrofilos: 6000, pcrMgL: 25 }).alterados, ['PCR > 20 mg/L', 'neutrófilos > 5.200/mm³'])
})
test('AAP 2021: temperatura > 38,5 °C conta só de 22 a 60 dias e sem procalcitonina', () => {
  assert.deepEqual(marcadoresAap2021('22-28', { temperatura: 38.8, pcrMgL: 5, neutrofilos: 3000 }).alterados, ['temperatura > 38,5 °C (sem procalcitonina)'])
  assert.deepEqual(marcadoresAap2021('22-28', { temperatura: 38.8, procalcitonina: 0.2 }).alterados, [])
  assert.deepEqual(marcadoresAap2021('8-21', { temperatura: 39, pcrMgL: 5 }).alterados, [])
})
test('PECARN 2019: baixo risco com urina negativa, neutrófilos ≤ 4.090 e procalcitonina ≤ 1,71', () => {
  assert.equal(pecarn2019({ urinaNegativa: true, neutrofilos: 4090, procalcitonina: 1.71 }), 'baixo-risco')
  assert.equal(pecarn2019({ urinaNegativa: true, neutrofilos: 4091, procalcitonina: 0.1 }), 'nao-baixo-risco')
  assert.equal(pecarn2019({ urinaNegativa: false, neutrofilos: 2000, procalcitonina: 0.1 }), 'nao-baixo-risco')
  assert.equal(pecarn2019({ neutrofilos: 2000, procalcitonina: 0.1 }), null)
})
test('AAP 2021: KAS por faixa sem dose', () => {
  for (const lista of Object.values(KAS_AAP_2021)) for (const k of lista) assert.doesNotMatch(k.texto, /mg\/kg/)
})
