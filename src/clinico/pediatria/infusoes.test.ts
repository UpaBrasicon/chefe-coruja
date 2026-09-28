import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  GRUPOS_INFUSAO,
  INFUSOES_PED,
  alertasInfusao,
  dosePed,
  faixaEmMlH,
  fichaInfusoesPediatricas,
  velocidadePed,
  type InfusaoPed,
} from './infusoes.ts'

const i = (id: string): InfusaoPed => {
  const x = INFUSOES_PED.find((y) => y.id === id)
  assert.ok(x, id)
  return x
}
const r3 = (x: number | null) => Math.round(x! * 1000) / 1000

test('ficha: livro do ICr, pediátrica, versão .3, sem PedGuide/ANY App', () => {
  assert.equal(temReferenciaPediatrica(fichaInfusoesPediatricas), true)
  assert.equal(fichaInfusoesPediatricas.versao, '2026-09-27.3')
  assert.match(fichaInfusoesPediatricas.fontes[0].citacao, /ICr-HCFMUSP/)
  assert.doesNotMatch(JSON.stringify([fichaInfusoesPediatricas, INFUSOES_PED]), /PedGuide|ANY App/i)
})

test('infusões: ids únicos, página e texto do livro em todas; lista do apêndice completa', () => {
  const ids = INFUSOES_PED.map((x) => x.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const x of INFUSOES_PED) {
    assert.ok(GRUPOS_INFUSAO[x.grupo], x.id)
    assert.match(x.pagina, /^p\. \d/, x.id)
    assert.ok(x.textoLivro.length > 5, x.id)
    assert.ok(x.faixa[0] <= x.faixa[1], x.id)
    for (const t of [x.nota, x.errata, x.semCalculo, x.apresentacao].filter(Boolean)) assert.match(t!, /p\. \d/, `${x.id}: texto sem página`)
  }
  for (const id of ['amiodarona', 'cetamina', 'dexmedetomidina', 'dobutamina', 'dopamina', 'epinefrina', 'esmolol-has', 'esmolol-tsv', 'fentanil', 'lidocaina', 'midazolam',
    'milrinona', 'nitroprussiato', 'norepinefrina', 'octreotida', 'propofol-apendice', 'alprostadil-inicial', 'alprostadil-manutencao', 'rocuronio', 'tiopental', 'vecuronio', 'nacl3'])
    i(id)
})

test('valores do apêndice (faixa e máximo)', () => {
  assert.deepEqual(i('dopamina').faixa, [1, 20]); assert.equal(i('dopamina').maximo, 50)
  assert.deepEqual(i('dobutamina').faixa, [2, 20]); assert.equal(i('dobutamina').maximo, 40)
  assert.deepEqual(i('epinefrina').faixa, [0.1, 1])
  assert.deepEqual(i('nitroprussiato').faixa, [0.3, 3]); assert.equal(i('nitroprussiato').maximo, 10)
  assert.deepEqual(i('dexmedetomidina').faixa, [0.2, 1]); assert.equal(i('dexmedetomidina').maximo, 1.4)
  assert.equal(i('dexmedetomidina').tempo, 'h')
  assert.deepEqual(i('fentanil').faixa, [1, 3]); assert.equal(i('fentanil').tempo, 'h')
  assert.deepEqual(i('rocuronio').faixa, [7, 12])
  assert.deepEqual(i('vecuronio').faixa, [0.8, 2.5])
  assert.deepEqual(i('tiopental').faixa, [10, 100])
  assert.deepEqual(i('esmolol-tsv').faixa, [25, 100]); assert.equal(i('esmolol-tsv').maximo, 1000)
  assert.equal(i('esmolol-has').maximo, 500)
  assert.deepEqual(i('nacl3').faixa, [0.5, 1.5])
})

test('velocidade pela concentração informada e caminho inverso', () => {
  // dopamina 10 µg/kg/min, 20 kg, 1.600 µg/mL → 10 × 20 × 60 / 1600 = 7,5 mL/h
  assert.equal(velocidadePed(i('dopamina'), 10, 20, 1600), 7.5)
  assert.equal(dosePed(i('dopamina'), 7.5, 20, 1600), 10)
  // fentanil 2 µg/kg/h, 15 kg, 10 µg/mL → 3 mL/h
  assert.equal(velocidadePed(i('fentanil'), 2, 15, 10), 3)
  // glucagon é por minuto, sem kg: 10 µg/min a 100 µg/mL = 6 mL/h (peso não importa)
  assert.equal(velocidadePed(i('glucagon'), 10, Number.NaN, 100), 6)
  // NaCl 3%: dose já é volume — não pede concentração
  assert.equal(velocidadePed(i('nacl3'), 1, 20, Number.NaN), 20)
  // faixa inteira em mL/h
  assert.deepEqual(faixaEmMlH(i('norepinefrina'), 10, 40)!.map(r3), [0.75, 30])
  // entradas inválidas
  assert.equal(velocidadePed(i('dopamina'), 10, 0, 1600), null)
  assert.equal(velocidadePed(i('dopamina'), 10, 20, 0), null)
  assert.equal(velocidadePed(i('dopamina'), -1, 20, 1600), null)
  assert.equal(dosePed(i('dopamina'), 5, 20, Number.NaN), null)
})

test('errata do midazolam: apêndice "0,05 a 2 mcg/kg/min"; cálculo com 1 a 18 mcg/kg/min dos caps. (p. 127, 720)', () => {
  const m = i('midazolam')
  assert.deepEqual(m.faixa, [1, 18])
  assert.equal(m.numerador, 'mcg'); assert.equal(m.tempo, 'min')
  assert.match(m.textoLivro, /0,05 a 2 mcg\/kg\/minuto/)
  assert.match(m.errata!, /p\. 896.*p\. 127.*p\. 720/)
  // 18 µg/kg/min, 10 kg, 1.000 µg/mL → 10,8 mL/h
  assert.equal(r3(velocidadePed(m, 18, 10, 1000)), 10.8)
})

test('propofol: linha do apêndice (200–300 mcg/kg/min) sem cálculo; a do cap. de crise (5 mg/kg/h) calcula', () => {
  const ap = i('propofol-apendice')
  assert.ok(ap.semCalculo)
  assert.match(ap.semCalculo!, /p\. 127.*p\. 178/)
  assert.equal(velocidadePed(ap, 200, 20, 10000), null)
  assert.equal(faixaEmMlH(ap, 20, 10000), null)
  // 5 mg/kg/h, 20 kg, 10 mg/mL → 10 mL/h
  assert.equal(velocidadePed(i('propofol-crise'), 5, 20, 10), 10)
})

test('sem cálculo onde o livro não é coerente: vasopressina no choque, terlipressina contínua', () => {
  for (const id of ['vasopressina-choque', 'terlipressina']) {
    assert.ok(i(id).semCalculo, id)
    assert.equal(velocidadePed(i(id), 1, 20, 1), null, id)
  }
  assert.equal(r3(velocidadePed(i('vasopressina-di'), 0.5, 20, 100)), 0.1)
})

test('alertas: acima do máximo, fora da faixa, teto absoluto e concentração máxima do livro', () => {
  assert.equal(alertasInfusao(i('dopamina'), 55, 20, 1600)[0].tipo, 'acimaDoMaximo')
  assert.deepEqual(alertasInfusao(i('dopamina'), 30, 20, 1600), []) // acima da faixa usual mas abaixo do máx. 50
  assert.equal(alertasInfusao(i('epinefrina'), 2, 20, 20)[0].tipo, 'foraDaFaixa')
  assert.ok(alertasInfusao(i('dopamina'), 10, 20, 4000).some((a) => a.tipo === 'concentracao'))
  assert.ok(alertasInfusao(i('amiodarona'), 5, 20, 3000).some((a) => /2 mg\/mL/.test(a.texto)))
  const kcl = alertasInfusao(i('kcl'), 0.3, 20, 0.1)
  assert.equal(kcl.filter((a) => a.tipo === 'concentracao').length, 1) // > periférico, < central
  assert.equal(alertasInfusao(i('kcl'), 0.3, 20, 0.2).filter((a) => a.tipo === 'concentracao').length, 2)
  assert.ok(alertasInfusao(i('somatostatina'), 10, 10, 50).some((a) => a.tipo === 'tetoAbsoluto')) // 100 µg/h > 50
  assert.equal(alertasInfusao(i('somatostatina'), 3.5, 10, 50).length, 0)
})
