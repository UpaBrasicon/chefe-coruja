// node --experimental-strip-types --test src/content/publicoFerramentas.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { publicoDaFerramenta, semReferenciaPediatrica, valeEmAdulto, valeEmCrianca } from './publicoFerramentas.ts'

test('público: o padrão é adulto, com o selo sem referência pediátrica', () => {
  assert.equal(publicoDaFerramenta('emergencias', 'pcr-adulto'), 'adulto')
  assert.equal(publicoDaFerramenta('escores', 'heart'), 'adulto')
  assert.equal(semReferenciaPediatrica(publicoDaFerramenta('calculadoras', 'drogas-vasoativas')), true)
  assert.equal(valeEmCrianca('adulto'), false)
})

test('público: seção Pediatria e Dengue — criança só valem em criança', () => {
  assert.equal(publicoDaFerramenta('pediatria', 'bolus'), 'pediatrico')
  assert.equal(publicoDaFerramenta('dengue', 'manual-dengue'), 'pediatrico')
  assert.equal(valeEmAdulto('pediatrico'), false)
  assert.equal(semReferenciaPediatrica('pediatrico'), false)
})

test('público: hiperpotassemia tem fonte pediátrica na ficha; jogos não calculam paciente', () => {
  assert.equal(publicoDaFerramenta('protocolos', 'hiperpotassemia'), 'ambos')
  const ficha = readFileSync(join(import.meta.dirname, '..', 'clinico', 'hiperpotassemia.ts'), 'utf8')
  assert.match(ficha, /publico: 'ambos'/)
  assert.match(ficha, /pediatrica: true/)
  assert.equal(publicoDaFerramenta('games', 'infection-pneumonia'), 'sem_idade')
})

test('público: o declarado no registro vence a regra', () => {
  assert.equal(publicoDaFerramenta('ventilacao-mecanica', 'x', 'ambos'), 'ambos')
})
