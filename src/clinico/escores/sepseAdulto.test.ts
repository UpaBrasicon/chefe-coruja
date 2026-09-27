// node --experimental-strip-types --test src/clinico/escores/sepseAdulto.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { sepseAdulto } from './sepseAdulto.ts'

// Índice da opção = pontos em cada sistema do SOFA; Não/Sim = 0/1.
const base = (extra: Respostas = {}): Respostas => ({
  qGlasgow: 0, qFr: 0, qPas: 0, resp: 0, coag: 0, hep: 0, cv: 0, snc: 0, renal: 0, vaso: 0, volume: 0, ...extra,
})

test('sepse: SOFA 1 não é sepse; SOFA 2 é sepse (corte)', () => {
  const um = sepseAdulto.calcular(base({ resp: 1 }))!
  assert.equal(um.valor, '1')
  assert.equal(um.estado, 0)
  assert.equal(um.rotulo, 'SOFA')
  const dois = sepseAdulto.calcular(base({ resp: 1, coag: 1 }))!
  assert.equal(dois.rotulo, 'Sepse')
  assert.equal(dois.estado, 1)
  assert.deepEqual(dois.derivados[5], ['Sistemas com disfunção', '2 de 6'])
})
test('sepse: choque séptico exige vasopressor, lactato ≥ 2 e ressuscitação feita', () => {
  const c = sepseAdulto.calcular(base({ cv: 3, renal: 2, vaso: 1, volume: 1, lac: 2 }))!
  assert.equal(c.rotulo, 'Choque séptico')
  assert.equal(c.valor, '5')
  assert.equal(c.estado, 2)
  assert.equal(sepseAdulto.calcular(base({ cv: 3, renal: 2, vaso: 1, volume: 1, lac: 1.9 }))!.estado, 1)
  const semVol = sepseAdulto.calcular(base({ cv: 3, renal: 2, vaso: 1, volume: 0, lac: 4 }))!
  assert.equal(semVol.estado, 1)
  assert.match(semVol.alerta!, /ressuscitação volêmica/)
  assert.match(sepseAdulto.calcular(base({ cv: 3, vaso: 1, volume: 1 }))!.derivados[3][1], /não informado/)
})
test('sepse: qSOFA positivo com SOFA < 2 gera alerta; qSOFA 1 é negativo', () => {
  const r = sepseAdulto.calcular(base({ qGlasgow: 1, qFr: 1 }))!
  assert.match(r.derivados[0][1], /^2 de 3 · positivo/)
  assert.match(r.alerta!, /qSOFA positivo/)
  assert.match(sepseAdulto.calcular(base({ qGlasgow: 1 }))!.derivados[0][1], /^1 de 3 · negativo/)
})
test('sepse: clareamento de lactato (5 → 4,5 em 2 h = 10%, na referência; 5 → 4,6 abaixo)', () => {
  const ok = sepseAdulto.calcular(base({ resp: 2, lacAnt: 5, lac: 4.5 }))!
  assert.match(ok.derivados[4][1], /^10% em 2 h .* referência atingida/)
  const baixo = sepseAdulto.calcular(base({ resp: 2, lacAnt: 5, lac: 4.6 }))!
  assert.match(baixo.derivados[4][1], /ABAIXO/)
  assert.match(baixo.alerta!, /abaixo da referência/)
  // 4 h pedem 20%
  assert.match(sepseAdulto.calcular(base({ resp: 2, lacAnt: 5, lac: 4.5, horas: 4 }))!.derivados[4][1], /ABAIXO/)
})
test('sepse: incompleto ou número fora da faixa devolve null', () => {
  const r = base()
  delete r.renal
  assert.equal(sepseAdulto.calcular(r), null)
  assert.equal(sepseAdulto.calcular({}), null)
  assert.equal(sepseAdulto.calcular(base({ lac: 300 })), null)
  assert.equal(sepseAdulto.calcular(base({ lac: 2, horas: 0 })), null)
})
test('sepse: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(sepseAdulto.ficha.publico, 'adulto')
  assert.ok(sepseAdulto.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(sepseAdulto.ficha), false)
})
