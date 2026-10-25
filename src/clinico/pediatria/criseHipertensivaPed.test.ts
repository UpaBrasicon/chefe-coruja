// node --experimental-strip-types --test src/clinico/pediatria/criseHipertensivaPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  AAP_PA_2017, DOSES_CRISE_HA, HIDRALAZINA_IV, acimaDoP95, classificar13ouMais, classificarMenor13, fichaCriseHipertensivaPed, pamMinima8h, percentisAap2017,
} from './criseHipertensivaPed.ts'
import { PA_AAP_MENINAS, PA_AAP_MENINOS } from './paAap2017.ts'

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

// ── Tabelas 4 e 5 da AAP 2017 (lacunas da Central, lote 3) ──

test('crise HA: ficha .1 com a AAP 2017 depois do livro', () => {
  assert.equal(fichaCriseHipertensivaPed.versao, '2026-10-25.1')
  assert.equal(fichaCriseHipertensivaPed.fontes.at(-1), AAP_PA_2017)
  assert.equal(temReferenciaPediatrica(fichaCriseHipertensivaPed), true)
})
test('AAP 2017, Tabela 4: menino de 1 ano com 82,4 cm (coluna p50) — p90 100/53, p95 103/55', () => {
  const r = percentisAap2017('M', 1, 82.4)!
  assert.equal(r.percentilEstatura, 50)
  assert.deepEqual([r.p90s, r.p95s, r.p90d, r.p95d], [100, 103, 53, 55])
})
test('AAP 2017, Tabela 5: menina de 17 anos com 174 cm usa a coluna p95 (173,7 cm) — p95 128/82', () => {
  const r = percentisAap2017('F', 17, 174)!
  assert.equal(r.percentilEstatura, 95)
  assert.equal(r.foraDasColunas, true)
  assert.deepEqual([r.p95s, r.p95d], [128, 82])
})
test('AAP 2017: coluna da estatura mais próxima; idade em anos completos; fora de 1–17 não calcula', () => {
  assert.equal(percentisAap2017('M', 5.9, 112)!.percentilEstatura, 50)
  assert.equal(percentisAap2017('M', 5.9, 112)!.idade, 5)
  assert.equal(percentisAap2017('F', 0.5, 70), null)
  assert.equal(percentisAap2017('F', 18, 160), null)
  assert.equal(percentisAap2017('F', 8, 0), null)
})
test('AAP 2017: p95 + 12 da tabela é sempre p95 + 12 (conferido na geração dos dados)', () => {
  for (const tab of [PA_AAP_MENINOS, PA_AAP_MENINAS]) {
    assert.equal(Object.keys(tab).length, 17)
    for (const l of Object.values(tab)) {
      assert.equal(l.cm.length, 7)
      for (const k of [0, 3, 6]) assert.ok(l.p50.pas[k] < l.p90.pas[k] && l.p90.pas[k] < l.p95.pas[k])
    }
  }
})
