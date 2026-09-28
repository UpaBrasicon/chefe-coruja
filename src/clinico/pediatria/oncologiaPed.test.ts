// node --experimental-strip-types --test src/clinico/pediatria/oncologiaPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  DOSES_NEUTROPENIA, DOSES_SLT, alopurinolM2, caspofungina, classificarSlt, criteriosLabSlt, crioOncoU, diureseAlvoSlt, fichaOncologiaPed, hidratacaoSltMlDia,
  indicaCitorreducao, leituraNeutrofilos, mascc, oseltamivirMg, produtoCaP,
} from './oncologiaPed.ts'

const d = (id: string) => [...DOSES_SLT, ...DOSES_NEUTROPENIA].find((x) => x.id === id)!

test('Cairo-Bishop (Tabela 2, p. 695)', () => {
  assert.equal(temReferenciaPediatrica(fichaOncologiaPed), true)
  const c = criteriosLabSlt({ acidoUrico: 8, potassio: 5, fosforo: 6.5, calcio: 8 })
  assert.deepEqual(c, ['ácido úrico', 'fósforo'])
  assert.equal(classificarSlt(c.length, false), 'SLTL')
  assert.equal(classificarSlt(c.length, true), 'SLTC')
  assert.equal(classificarSlt(1, true), 'sem critério')
  assert.deepEqual(criteriosLabSlt({ acidoUrico: 0, potassio: 0, fosforo: 0, calcio: 0 }, new Set(['calcio'])), ['cálcio'])
  assert.equal(produtoCaP(7, 10), 70)
})

test('hidratação por m², diurese-alvo e alopurinol (p. 699–702)', () => {
  assert.deepEqual(hidratacaoSltMlDia(0.5), [1000, 1500])
  assert.deepEqual(diureseAlvoSlt(8, 0.4), { mlKgH: [32, 48], mlM2H: [32, 40] })
  assert.equal(diureseAlvoSlt(20, 0).mlKgH, null)
  assert.deepEqual(alopurinolM2(1), { porDose: [50, 100], dia: [150, 300], maxDia: 300 })
  assert.deepEqual(calcularDoseLivro(d('alopurinol'), 100)!.dia, [800, 800])
  assert.deepEqual(calcularDoseLivro(d('rasburicase'), 10)!.porDose, [1.5, 1.5])
})

test('hematológicas e hiperviscosidade (p. 705–707)', () => {
  assert.equal(crioOncoU(25), 5)
  assert.equal(indicaCitorreducao(150_000, 'LMA', false), true)
  assert.equal(indicaCitorreducao(150_000, 'LLA', false), false)
  assert.equal(indicaCitorreducao(150_000, 'LLA', true), true)
})

test('neutropenia febril (p. 708–715)', () => {
  assert.equal(leituraNeutrofilos(50, false), 'profunda')
  assert.equal(leituraNeutrofilos(800, true), 'neutropenia')
  assert.equal(leituraNeutrofilos(800, false), 'sem')
  assert.deepEqual(mascc(5, new Set(['semHipotensao', 'semDpoc', 'solido', 'idade'])), { pontos: 20, baixoRisco: false })
  assert.equal(mascc(5, new Set(['semHipotensao', 'semDpoc', 'solido', 'idade', 'domicilio'])).baixoRisco, true)
  assert.deepEqual(calcularDoseLivro(d('cefepima'), 50)!.dia, [6000, 6000])
  assert.deepEqual(calcularDoseLivro(d('vancomicina'), 80)!.porDose, [1000, 1000])
  assert.deepEqual(caspofungina(1.2), { ataque: 70, manutencao: 60 })
  assert.deepEqual(oseltamivirMg(23), [45, 60])
  assert.deepEqual(oseltamivirMg(41), [75])
})
