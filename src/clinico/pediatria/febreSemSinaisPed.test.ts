// node --experimental-strip-types --test src/clinico/pediatria/febreSemSinaisPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  AAP_FEBRIL_2021, DOSES_FSSL, FATORES_URINA, KAS_AAP_2021, LIVRO_COLETA_URINA, PECARN_FEBRIL_2019, faixaAap2021, faixaColetaUrina, faixaFssl, fichaFebreSemSinais, leituraColetaUrina, leucogramaAlterado, marcadoresAap2021, pcrAlterada, pecarn2019,
} from './febreSemSinaisPed.ts'
import { FATORES_FIGURA2 } from './ituPed.ts'

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

// Pedido 7 do RT (11/11/2026, opção A): a coleta de urina segue a Figura 2 da AAP 2026, a mesma lista da ITU.
test('coleta de urina: a lista da Figura 2, igual à da ITU, sem etnia', () => {
  assert.deepEqual(FATORES_URINA.map((f) => f.texto), FATORES_FIGURA2)
  assert.equal(new Set(FATORES_URINA.map((f) => f.id)).size, FATORES_URINA.length)
  for (const f of FATORES_URINA) assert.doesNotMatch(f.texto, /etnia|raça|branc/i)
  assert.match(LIVRO_COLETA_URINA, /etnia/)
})
test('coleta de urina: faixas e leitura sem número mínimo', () => {
  assert.equal(faixaColetaUrina(NaN), 'indefinido')
  assert.equal(faixaColetaUrina(1), 'menor-2m')
  assert.equal(faixaColetaUrina(2), '2-24m')
  assert.equal(faixaColetaUrina(24), '2-24m')
  assert.equal(faixaColetaUrina(25), 'maior-24m')
  const l = leituraColetaUrina(10, 2)
  assert.match(l, /2 fatores marcados/)
  assert.match(l, /não dá número mínimo/)
  assert.doesNotMatch(l, /coletar urina\.|indicada/)
  assert.match(leituraColetaUrina(1, 3), /Abaixo de 2 meses/)
  assert.match(leituraColetaUrina(30, 0), /não se aplica/)
})

test('doses (cap. 45 e Apêndice)', () => {
  assert.deepEqual(calcularDoseLivro(d('amoxicilina'), 10)!.dia, [500, 900])
  assert.deepEqual(calcularDoseLivro(d('cefuroxima-vo'), 40)!.porDose, [400, 500])
  assert.deepEqual(calcularDoseLivro(d('amoxclav-7'), 50)!.dia, [1250, 1750])
  assert.equal(d('ceftriaxona').neonatal, undefined)
})

// ── AAP 2021 e PECARN 2019 (lacunas da Central, lote 3) ──

test('febre: ficha com AAP 2021, PECARN 2019 e AAP 2026 da ITU depois do livro', () => {
  assert.equal(fichaFebreSemSinais.versao, '2026-11-11.1')
  assert.deepEqual(fichaFebreSemSinais.fontes.slice(-3, -1), [AAP_FEBRIL_2021, PECARN_FEBRIL_2019])
  assert.match(fichaFebreSemSinais.fontes.at(-1)!.citacao, /Urinary Tract Infection in Children.*Figura 2, p\. 28/)
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
