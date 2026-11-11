// node --experimental-strip-types --test src/clinico/pediatria/tetanoRaivaPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ANTIBIOTICO_TETANO_PED, IMUNOBIOLOGICOS_TETANO_PED, RAIVA_PED, SEDATIVOS_TETANO_PED, VACINA_TETANO_PED, VOLUME_MAXIMO_MUSCULO,
  fichaTetanoRaivaPed, penicilinaTetanoPed,
} from './tetanoRaivaPed.ts'

// Escores P2/P3, item P11 (decisão A do RT, 11/11/2026): doses só do MS.
test('tétano e raiva na criança: ficha pediátrica só com fontes do MS', () => {
  assert.equal(fichaTetanoRaivaPed.publico, 'pediatrico')
  assert.equal(temReferenciaPediatrica(fichaTetanoRaivaPed), true)
  assert.ok(fichaTetanoRaivaPed.fontes.every((f) => /Ministério da Saúde/.test(f.citacao)))
  assert.ok(fichaTetanoRaivaPed.fontes.every((f) => f.pediatrica))
})
test('tétano: penicilina 50.000–100.000 UI/kg/dia em 6 doses (Quadro 3)', () => {
  const r = penicilinaTetanoPed(20)!
  assert.deepEqual(r.uiDia, [1_000_000, 2_000_000])
  assert.equal(Math.round(r.uiDose[0]), 166_667)
  assert.equal(Math.round(r.uiDose[1]), 333_333)
  assert.equal(penicilinaTetanoPed(0), null)
  assert.match(ANTIBIOTICO_TETANO_PED.errataMetronidazol, /Não é calculado/)
})
test('tétano: SAT e IGHAT sem mudança pela idade; sedativos só como impressos', () => {
  assert.match(IMUNOBIOLOGICOS_TETANO_PED.ighat, /250 UI/)
  assert.match(IMUNOBIOLOGICOS_TETANO_PED.ighat, /para crianças ou adultos/)
  assert.match(IMUNOBIOLOGICOS_TETANO_PED.sat, /5\.000 UI/)
  assert.match(SEDATIVOS_TETANO_PED.errata, /não são calculadas/)
})
test('tétano: vacina pela idade (penta e DTP antes dos 7 anos; dT a partir dos 7)', () => {
  assert.match(VACINA_TETANO_PED.menor7, /penta/)
  assert.match(VACINA_TETANO_PED.menor7, /15 meses e aos 4 anos/)
  assert.match(VACINA_TETANO_PED.aPartir7, /dT/)
})
test('raiva: soro caso a caso na criança, vasto lateral abaixo de 2 anos, nunca no glúteo', () => {
  assert.match(RAIVA_PED.soroCasoACaso, /caso a caso/)
  assert.match(RAIVA_PED.vacinaIm, /menores de 2 anos/)
  assert.match(RAIVA_PED.vacinaIm, /Nunca no glúteo/)
  assert.equal(VOLUME_MAXIMO_MUSCULO.length, 4)
  assert.equal(VOLUME_MAXIMO_MUSCULO[0].vastoLateral, '1,0 mL')
  assert.equal(VOLUME_MAXIMO_MUSCULO[2].deltoide, '0,5 mL')
})
test('a tela usa o soro por UI/kg do MS e não o fluxograma do manual do adulto', () => {
  const tela = readFileSync('src/pages/plantonista/pediatria/TetanoRaivaPed.tsx', 'utf8')
  assert.match(tela, /doseSoroRaiva/)
  assert.match(tela, /profilaxiaTetanoGvs/)
  assert.doesNotMatch(tela, /profilaxiaRaiva\(|profilaxiaTetano\(|tratamentoTetanoPorPeso/)
})
