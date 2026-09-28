// node --experimental-strip-types --test src/clinico/pediatria/criseHipertensivaPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  DOSES_CRISE_HA, HIDRALAZINA_IV, acimaDoP95, classificar13ouMais, classificarMenor13, fichaCriseHipertensivaPed, pamMinima8h,
} from './criseHipertensivaPed.ts'

const p = { p90s: 110, p95s: 114, p90d: 70, p95d: 75 }

test('Tabela 1 (p. 272), 1 a < 13 anos: percentis informados, "o que for menor"', () => {
  assert.equal(temReferenciaPediatrica(fichaCriseHipertensivaPed), true)
  assert.equal(classificarMenor13(105, 60, p), 'normal')
  assert.equal(classificarMenor13(111, 60, p), 'elevada')
  assert.equal(classificarMenor13(115, 60, p), 'estagio1')
  assert.equal(classificarMenor13(126, 60, p), 'estagio2')
  assert.equal(classificarMenor13(100, 88, p), 'estagio2') // 75 + 12 = 87
  // p95 alto: o corte fixo de 140 é menor que p95 + 12
  assert.equal(classificarMenor13(140, 60, { p90s: 125, p95s: 132, p90d: 80, p95d: 85 }), 'estagio2')
  assert.equal(classificarMenor13(NaN, 60, p), null)
})

test('Tabela 1, ≥ 13 anos: cortes fixos', () => {
  assert.equal(classificar13ouMais(118, 70), 'normal')
  assert.equal(classificar13ouMais(125, 70), 'elevada')
  assert.equal(classificar13ouMais(125, 82), 'estagio1')
  assert.equal(classificar13ouMais(141, 70), 'estagio2')
})

test('PAM: redução máxima de 25% em 8 h (p. 275); > 30 mmHg acima do p95 (p. 272)', () => {
  assert.equal(pamMinima8h(120), 90)
  assert.equal(acimaDoP95(150, 118), 32)
})

test('Tabela 3 (p. 276): doses VO por peso; hidralazina IV vem do Apêndice', () => {
  const iv = HIDRALAZINA_IV
  assert.ok(iv && iv.maximo === 25)
  const vo = DOSES_CRISE_HA.find((x) => x.id === 'hidralazina-vo')!
  assert.deepEqual(calcularDoseLivro(vo, 100)!.porDose, [20, 20])
  assert.ok(vo.errata)
  assert.deepEqual(calcularDoseLivro(DOSES_CRISE_HA.find((x) => x.id === 'isradipina')!, 20)!.porDose, [1, 2])
  assert.deepEqual(calcularDoseLivro(DOSES_CRISE_HA.find((x) => x.id === 'minoxidil')!, 80)!.porDose, [8, 10])
})
