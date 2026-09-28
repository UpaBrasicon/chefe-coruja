import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  aaEsperado, cortesVni, fichaOxigenacaoAdulto, gradienteAa, incrementoCateter, instalacaoHipercapnia, lerGradienteAa, lerIrpa, lerPF, lerSat, relacaoPF,
} from './oxigenacao.ts'
import { fichaDispneiaAdulto, lerDispneia } from './dispneia.ts'

const perto = (a: number | null | undefined, b: number, eps = 1e-9) => assert.ok(a !== null && a !== undefined && Math.abs(a - b) < eps, `${a} ≠ ${b}`)

test('oxigenação/dispneia: fichas adulto, sem referência pediátrica', () => {
  for (const f of [fichaOxigenacaoAdulto, fichaDispneiaAdulto]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('gradiente A-a (Tabela 1, p. 371): 130 − (PaO2 + PaCO2) e esperado pela idade', () => {
  assert.equal(gradienteAa(80, 40), 10)
  const e = aaEsperado(40)!
  perto(e.formula1, 14)
  perto(e.formula2, 10.9)
  const l = lerGradienteAa(60, 50, 40)!
  assert.equal(l.gradiente, 20)
  assert.ok(l.notas.some((n) => /Acima do esperado pelas duas/.test(n)))
  assert.ok(l.notas.some((n) => /hipoventilação global/.test(n)))
  const l2 = lerGradienteAa(50, 55, 40)!
  assert.equal(l2.gradiente, 25)
  assert.ok(l2.notas.some((n) => /doença pulmonar intrínseca/.test(n)))
  // entre as duas fórmulas: 12 para 40 anos (10,9 e 14)
  assert.ok(lerGradienteAa(78, 40, 40)!.notas.some((n) => /Entre os valores/.test(n)))
  assert.ok(lerGradienteAa(100, 40)!.notas.some((n) => /negativo/.test(n)))
})

test('P/F (p. 371)', () => {
  perto(relacaoPF(80, 40), 200)
  assert.equal(relacaoPF(80, 0), null)
  assert.match(lerPF(199), /grave hipoxemia/)
  assert.match(lerPF(250), /abaixo da faixa normal/)
  assert.match(lerPF(400), /faixa normal/)
})

test('IRpA (p. 370, 373–374) e hipercapnia (Tabela 5, p. 377–378)', () => {
  assert.match(lerIrpa({ pao2: 55, paco2: 35 }).tipo!, /Tipo 1/)
  assert.match(lerIrpa({ pao2: 55, paco2: 50 }).tipo!, /Tipo 2/)
  assert.equal(lerIrpa({ pao2: 55, paco2: 45 }).tipo, null)
  assert.deepEqual(lerIrpa({ pao2: 70, paco2: 40, spo2: 89 }).criterios, ['SpO2 < 90%'])
  assert.equal(instalacaoHipercapnia(50, 7.3).length, 1)
  assert.equal(instalacaoHipercapnia(50, 7.34).length, 2)
  assert.match(instalacaoHipercapnia(50, 7.35)[0], /Crônica/)
  assert.equal(instalacaoHipercapnia(45, 7.2).length, 0)
})

test('cateter nasal: incremento dos dois capítulos, sem FiO2 de partida', () => {
  const c = incrementoCateter(3)!
  assert.deepEqual(c.cap1, [3, 12])
  assert.deepEqual(c.cap27, [9, 12])
  assert.equal(c.avisos.length, 0)
  assert.equal(incrementoCateter(7)!.avisos.length, 3)
  assert.equal(incrementoCateter(0), null)
})

test('VNI (p. 378, 382–383): cortes numéricos', () => {
  assert.equal(cortesVni({ fr: 23, paco2: 45, pf: 200, ph: 7.3, idade: 65, apache: 12 }).length, 0)
  assert.equal(cortesVni({ fr: 26, paco2: 46, pf: 199, ph: 7.29, idade: 66, apache: 13 }).length, 6)
})

test('SatO2: alvo com e sem risco hipercápnico (cap. 1, p. 35–36)', () => {
  assert.ok(lerSat(90, true).some((x) => /Dentro do alvo 88–92/.test(x)))
  assert.ok(lerSat(93, false).some((x) => /< 94%/.test(x)))
  assert.ok(lerSat(84, false).some((x) => /não reinalante/.test(x)))
  assert.deepEqual(lerSat(0, false), [])
})

test('dispneia (cap. 26 e cap. 1): cortes', () => {
  const r = lerDispneia({ fr: 31, sat: 89, pao2: 54, fc: 101, tec: 4, ict: 0.55, bnp: 150, idade: 50, macosAno: 45 })
  assert.equal(r.gravidade.length, 2)
  assert.ok(r.abcde.some((a) => /Taquipneia/.test(a.texto)))
  assert.ok(r.abcde.some((a) => /entre 88 e 90/.test(a.texto)))
  assert.ok(r.exames.some((a) => /> 0,5/.test(a.texto)))
  assert.ok(r.exames.some((a) => /BNP > 100/.test(a.texto)))
  assert.equal(r.oxigenio.length, 2)
  assert.equal(r.historia.length, 2)
  const n = lerDispneia({ fr: 18, sat: 95, ict: 0.65, bnp: 100 })
  assert.equal(n.gravidade.length, 0)
  assert.ok(n.abcde.some((a) => /entre 16 e 20/.test(a.texto)))
  assert.ok(n.exames.some((a) => /> 0,6/.test(a.texto)))
  assert.ok(n.exames.some((a) => /≤ 100/.test(a.texto)))
})
