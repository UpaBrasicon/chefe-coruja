// node --experimental-strip-types --test src/clinico/escores/sepseAdulto.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { sepseAdulto } from './sepseAdulto.ts'

// Índice da opção = pontos em cada sistema do SOFA; Não/Sim = 0/1; qSOFA são marcas (true).
const base = (extra: Respostas = {}): Respostas => ({
  resp: 0, coag: 0, hep: 0, cv: 0, snc: 0, renal: 0, vaso: 0, volume: 0, ...extra,
})

test('sepse: SOFA 1 não é sepse; SOFA 2 é sepse (corte)', () => {
  const um = sepseAdulto.calcular(base({ resp: 1 }))!
  assert.equal(um.valor, '1')
  assert.equal(um.estado, 0)
  assert.equal(um.rotulo, 'SOFA')
  const dois = sepseAdulto.calcular(base({ resp: 1, coag: 1 }))!
  assert.equal(dois.rotulo, 'Sepse')
  assert.equal(dois.estado, 1)
  assert.deepEqual(dois.derivados[7], ['Sistemas com disfunção', '2 de 6'])
})
test('sepse: choque séptico pelo Sepsis-3 exige vasopressor, lactato ≥ 2 e ressuscitação feita; pelo ILAS, vasopressor após a reposição basta', () => {
  const c = sepseAdulto.calcular(base({ cv: 3, renal: 2, vaso: 1, volume: 1, lac: 2 }))!
  assert.equal(c.rotulo, 'Choque séptico')
  assert.equal(c.valor, '5')
  assert.equal(c.estado, 2)
  assert.match(c.derivados[4][1], /independentemente do lactato.*· preenchido$/)
  // lactato < 2 com vasopressor após volume: não é choque pelo Sepsis-3, mas é pelo ILAS (p. 5)
  const ilas = sepseAdulto.calcular(base({ cv: 3, renal: 2, vaso: 1, volume: 1, lac: 1.9 }))!
  assert.equal(ilas.rotulo, 'Choque séptico (ILAS)')
  assert.equal(ilas.estado, 2)
  assert.match(ilas.nota, /Sepsis-3 ainda exige lactato/)
  const semVol = sepseAdulto.calcular(base({ cv: 3, renal: 2, vaso: 1, volume: 0, lac: 4 }))!
  assert.equal(semVol.estado, 1)
  assert.match(semVol.derivados[4][1], /não preenchido$/)
  assert.match(semVol.alerta!, /ressuscitação volêmica/)
  assert.match(sepseAdulto.calcular(base({ cv: 3, vaso: 1, volume: 1 }))!.derivados[5][1], /não informado/)
})
test('sepse: qSOFA positivo com SOFA < 2 gera alerta; qSOFA 1 é negativo', () => {
  const r = sepseAdulto.calcular(base({ qGlasgow: true, qFr: true }))!
  assert.match(r.derivados[1][1], /^2 de 3 · positivo/)
  assert.match(r.alerta!, /qSOFA positivo/)
  assert.match(sepseAdulto.calcular(base({ qGlasgow: true }))!.derivados[1][1], /^1 de 3 · negativo/)
})
test('sepse: clareamento de lactato (5 → 4,5 em 2 h = 10%, na referência; 5 → 4,6 abaixo)', () => {
  const ok = sepseAdulto.calcular(base({ resp: 2, lacAnt: 5, lac: 4.5 }))!
  assert.match(ok.derivados[6][1], /^10% em 2 h .* referência atingida/)
  const baixo = sepseAdulto.calcular(base({ resp: 2, lacAnt: 5, lac: 4.6 }))!
  assert.match(baixo.derivados[6][1], /ABAIXO/)
  assert.match(baixo.alerta!, /abaixo da referência/)
  // 4 h pedem 20%
  assert.match(sepseAdulto.calcular(base({ resp: 2, lacAnt: 5, lac: 4.5, horas: 4 }))!.derivados[6][1], /ABAIXO/)
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

test('sepse: SSC 2026 — qSOFA é opcional e o rastreio aponta o NEWS2', () => {
  const r = sepseAdulto.calcular(base())!
  assert.ok(r)
  assert.match(r.derivados[0][1], /NEWS2/)
  assert.ok(sepseAdulto.itens.filter((i) => i.id.startsWith('q')).every((i) => i.tipo === 'marca'))
  assert.ok(sepseAdulto.ficha.fontes.some((f) => f.url === 'https://doi.org/10.1097/CCM.0000000000007075'))
})

test('sepse: versão .3 de 28/09 cita o ILAS jul/2026 e o critério de choque dele', () => {
  assert.equal(sepseAdulto.ficha.versao, '2026-09-28.3')
  assert.ok(sepseAdulto.ficha.fontes.some((f) => /ILAS.*julho de 2026/.test(f.citacao)))
  const r = sepseAdulto.calcular(base())!
  assert.equal(r.derivados[4][0], 'Critério de choque séptico · ILAS jul/2026')
  assert.ok(r.cuidados!.some((c) => /ILAS jul\/2026.*4 horas/.test(c)))
})
