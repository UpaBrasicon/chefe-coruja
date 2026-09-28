// node --experimental-strip-types --test src/clinico/pediatria/denguePed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  albumina5, expansaoGrupoC, expansaoGrupoD, fichaDenguePed, grupoBParaC, grupoDenguePed, hidratacaoOral, manutencaoAdolescente, mlKgDiaCrianca, pressaoMediaLaco,
} from './denguePed.ts'

test('ficha pediátrica do livro do ICr', () => {
  assert.equal(temReferenciaPediatrica(fichaDenguePed), true)
})

test('grupo pelo achado mais grave (p. 448–450)', () => {
  assert.equal(grupoDenguePed(new Set()), 'A')
  assert.equal(grupoDenguePed(new Set(['laco'])), 'B')
  assert.equal(grupoDenguePed(new Set(['lactente'])), 'B')
  assert.equal(grupoDenguePed(new Set(['laco', 'vomitos'])), 'C')
  assert.equal(grupoDenguePed(new Set(['vomitos', 'choque'])), 'D')
})

test('grupo B → C: Ht > 38% ou plaquetas < 100.000 (p. 449)', () => {
  assert.equal(grupoBParaC(0, 0), null)
  assert.equal(grupoBParaC(38, 150_000), false)
  assert.equal(grupoBParaC(38.5, 0), true)
  assert.equal(grupoBParaC(0, 99_000), true)
})

test('Quadro 8: faixas de peso da criança, bordas 10 e 20 kg em "10 a 20 kg"', () => {
  assert.equal(mlKgDiaCrianca(9.9), 130)
  assert.equal(mlKgDiaCrianca(10), 100)
  assert.equal(mlKgDiaCrianca(20), 100)
  assert.equal(mlKgDiaCrianca(20.1), 80)
  const h = hidratacaoOral(8, 'crianca')!
  assert.equal(h.dia, 1040)
  assert.ok(Math.abs(h.sro - 346.67) < 0.01)
  assert.equal(hidratacaoOral(40, 'adolescente')!.dia, 2400)
  assert.equal(hidratacaoOral(0, 'crianca'), null)
})

test('expansões C e D, manutenção do adolescente e albumina 5%', () => {
  assert.deepEqual(expansaoGrupoC(15), [150, 300])
  assert.deepEqual(expansaoGrupoD(15), [300, 300])
  const m = manutencaoAdolescente(40)!
  assert.deepEqual(m[0].volumeMl, [1000, 1000])
  assert.deepEqual(m[1].mlH, [125, 125])
  const a = albumina5(10)!
  assert.deepEqual(a.volume, [100, 200])
  assert.deepEqual(a.albumina20, [25, 50])
  assert.deepEqual(a.gramas, [5, 10])
})

test('prova do laço: (PAS + PAD) ÷ 2 (errata do Quadro 5)', () => {
  assert.equal(pressaoMediaLaco(100, 60), 80)
  assert.equal(pressaoMediaLaco(60, 100), null)
})
