import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { ATAQUE_ESTADO_DE_MAL, TERCEIRA_LINHA, calcularAtaque, calcularTerceiraLinha, fichaEstadoDeMalAdulto } from './estadoDeMal.ts'

const at = (id: string) => ATAQUE_ESTADO_DE_MAL.find((x) => x.id === id)!
const t3 = (id: string) => TERCEIRA_LINHA.find((x) => x.id === id)!
const r2 = (x: number) => Math.round(x * 100) / 100

test('estado de mal: ficha adulto, manual do HC, id kebab e sem referência pediátrica', () => {
  assert.equal(fichaEstadoDeMalAdulto.publico, 'adulto')
  assert.match(fichaEstadoDeMalAdulto.id, /^adulto-[a-z0-9-]+$/)
  assert.match(fichaEstadoDeMalAdulto.fontes[0].citacao, /Manual de Medicina de Emergência.*p\. 627–631/)
  assert.equal(temReferenciaPediatrica(fichaEstadoDeMalAdulto), false)
  for (const d of [...ATAQUE_ESTADO_DE_MAL, ...TERCEIRA_LINHA]) assert.match(d.pagina, /^p\. \d+/, d.id)
})

test('estado de mal: fenitoína 20 mg/kg, 250 mg/5 mL, 50 mg/min (Tabela 4, p. 629)', () => {
  const r = calcularAtaque(at('fenitoina'), 70)!
  assert.deepEqual(r.mg, [1400, 1400])
  assert.deepEqual(r.ml, [28, 28])
  assert.deepEqual(r.tempos.map((t) => t.minutos[0]), [28, 56, 70]) // 50, 25 e 20 mg/min
})

test('estado de mal: valproato 40 mg/kg com teto de 3.000 mg (p. 629) e errata da velocidade', () => {
  const leve = calcularAtaque(at('valproato'), 70)!
  assert.deepEqual([leve.mg[1], leve.limitadoAoTeto, leve.ml![1], leve.tempos[0].minutos[1]], [2800, false, 28, 28])
  const pesado = calcularAtaque(at('valproato'), 90)! // 3.600 → 3.000
  assert.deepEqual([pesado.mg[1], pesado.limitadoAoTeto], [3000, true])
  assert.match(at('valproato').errata!, /6 mg\/kg\/min/)
})

test('estado de mal: fenobarbital 15–20 mg/kg, 200 mg/2 mL, 50–100 mg/min (p. 630) e 15 mg/kg na 1ª linha (p. 628)', () => {
  const r = calcularAtaque(at('fenobarbital-2'), 60)!
  assert.deepEqual(r.mg, [900, 1200])
  assert.deepEqual(r.ml, [9, 12])
  assert.deepEqual(r.tempos.map((t) => t.minutos), [[9, 12], [18, 24]])
  assert.deepEqual(calcularAtaque(at('fenobarbital-1'), 60)!.mg, [900, 900])
})

test('estado de mal: doses fixas da 1ª linha (p. 627–628) e midazolam IM 5 mg entre 13 e 40 kg', () => {
  const dz = calcularAtaque(at('diazepam'), 70)!
  assert.deepEqual([dz.mg, dz.ml, dz.tempos[0].minutos], [[10, 10], null, [2, 2]])
  assert.ok(at('diazepam').errata) // "10 mg/mL" x 5 mg/mL do anexo
  assert.deepEqual(calcularAtaque(at('midazolam-im'), 70)!.mg, [10, 10])
  assert.deepEqual(calcularAtaque(at('midazolam-im'), 40)!.mg, [5, 5])
  assert.deepEqual(calcularAtaque(at('midazolam-im'), 13)!.mg, [5, 5])
  assert.deepEqual(calcularAtaque(at('midazolam-im'), 41)!.mg, [10, 10])
  assert.deepEqual(calcularAtaque(at('lacosamida'), 0)!.mg, [200, 400])
})

test('estado de mal: peso inválido não calcula dose por peso', () => {
  assert.equal(calcularAtaque(at('fenitoina'), 0), null)
  assert.equal(calcularAtaque(at('fenitoina'), Number.NaN), null)
  assert.equal(calcularTerceiraLinha(t3('propofol'), -5), null)
})

test('estado de mal: 3ª linha — bolus e manutenção por peso (Tabela 5, p. 630–631)', () => {
  const mz = calcularTerceiraLinha(t3('midazolam'), 70)!
  assert.deepEqual([r2(mz.bolusMg[0]), mz.manutencaoMgH], [14, [7, 140]])
  assert.deepEqual(mz.manutencaoMlH, [7, 140]) // preparo do Anexo 1: 1 mg/mL
  const pr = calcularTerceiraLinha(t3('propofol'), 70)!
  assert.deepEqual([pr.bolusMg, pr.manutencaoMgH, pr.mgMlPreparo], [[140, 210], [280, 700], 10])
  assert.deepEqual(pr.manutencaoMlH, [28, 70])
  const qt = calcularTerceiraLinha(t3('quetamina'), 70)!
  assert.deepEqual([qt.bolusMg[0], qt.bolusAcumuladoMaxMg, qt.manutencaoMgH], [105, 315, [140, 350]])
  const tp = calcularTerceiraLinha(t3('tiopental'), 70)!
  assert.deepEqual([tp.bolusMg, tp.manutencaoMgH, tp.manutencaoMlH], [[210, 350], [210, 490], null])
})
