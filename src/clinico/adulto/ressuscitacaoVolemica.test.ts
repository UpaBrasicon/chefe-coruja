import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  CORTES_LACTATO, PEDIATRICO_NAO_IMPLEMENTADO, SOLUCOES_TABELA5, diureseMinimaMlH, diureseMlKgH, fichaRessuscitacaoAdulto, gatilhoVasopressina,
  lactatoMgDl, lactatoMmol, reducaoLactato, sodioNoVolume, somaSolutos, vazaoAliquota, vcSepse, volumeSepse,
} from './ressuscitacaoVolemica.ts'

test('ressuscitação: ficha adulto dos caps. 4 e 7, sem referência pediátrica', () => {
  assert.equal(fichaRessuscitacaoAdulto.publico, 'adulto')
  assert.match(fichaRessuscitacaoAdulto.id, /^adulto-[a-z0-9-]+$/)
  assert.equal(temReferenciaPediatrica(fichaRessuscitacaoAdulto), false)
  assert.ok(PEDIATRICO_NAO_IMPLEMENTADO.length > 0)
})

test('sepse: 30 mL/kg na 1ª hora, alíquotas de 250–500 mL (p. 122) ou de 200 mL (p. 74)', () => {
  assert.deepEqual(volumeSepse(70), { totalMl: 2100, mlH: 2100, aliquotas: [5, 9], aliquotasDe200: 11 })
  assert.equal(volumeSepse(0), null)
  assert.equal(vazaoAliquota(500, 10), 3000)
  assert.equal(vazaoAliquota(200, 10), 1200)
  assert.equal(vazaoAliquota(0, 10), null)
})

test('metas: diurese 0,5 mL/kg/h (p. 67/72)', () => {
  assert.equal(diureseMinimaMlH(80), 40)
  assert.deepEqual(diureseMlKgH(120, 4, 60), { mlKgH: 0.5, abaixoDe05: false })
  assert.equal(diureseMlKgH(100, 4, 60)!.abaixoDe05, true)
  assert.equal(diureseMlKgH(100, 0, 60), null)
})

test('lactato: 18 mg/dL = 2 mmol/L (p. 120) e meta de queda de 20% em 2 h (p. 72)', () => {
  assert.equal(lactatoMmol(36), 4)
  assert.equal(lactatoMgDl(2), 18)
  assert.deepEqual(CORTES_LACTATO.map((c) => c.mgDl), [13.5, 18, 36])
  const r = reducaoLactato(4, 3.2)!
  assert.ok(Math.abs(r.reducaoPct - 20) < 1e-9)
  assert.equal(r.atingiuMeta20, true)
  assert.ok(Math.abs(r.alvoMax - 3.2) < 1e-9)
  assert.equal(reducaoLactato(4, 3.5)!.atingiuMeta20, false)
  assert.equal(reducaoLactato(0, 1), null)
})

test('vasopressina: cap. 4 (> 5 µg/min após 6 h ou > 15 µg/min em 3 h) x cap. 7 (> 5 µg/min por mais de 6 h)', () => {
  assert.deepEqual(gatilhoVasopressina(8, 'ug/min', 6), { ugMin: 8, cap4Seis: true, cap4Tres: false, cap7: false })
  assert.deepEqual(gatilhoVasopressina(8, 'ug/min', 7), { ugMin: 8, cap4Seis: true, cap4Tres: false, cap7: true })
  assert.deepEqual(gatilhoVasopressina(20, 'ug/min', 3), { ugMin: 20, cap4Seis: false, cap4Tres: true, cap7: false })
  assert.equal(gatilhoVasopressina(0.25, 'ug/kg/min', 4, 80)!.ugMin, 20)
  assert.equal(gatilhoVasopressina(0.25, 'ug/kg/min', 4), null)
  assert.equal(gatilhoVasopressina(5, 'ug/min', 10)!.cap7, false) // > 5, não ≥ 5
})

test('soluções: Tabela 5 (p. 74) e a osmolaridade impressa do Ringer lactato fica anotada', () => {
  const rl = SOLUCOES_TABELA5.find((s) => s.id === 'rl')!
  assert.equal(rl.osm, 208)
  assert.ok(somaSolutos(rl) > rl.osm!)
  assert.ok(rl.nota)
  assert.equal(sodioNoVolume('sf', 1000), 154)
  assert.equal(sodioNoVolume('rl', 500), 65.5)
  assert.equal(sodioNoVolume('x', 500), null)
})

test('VM na sepse: VC 4–6 mL/kg (Tabela 12, p. 127)', () => {
  assert.deepEqual(vcSepse(70), [280, 420])
  assert.equal(vcSepse(-1), null)
})
