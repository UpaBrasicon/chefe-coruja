// node --experimental-strip-types --test src/clinico/escores/genebraRevisado.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { genebraRevisado } from './genebraRevisado.ts'

const CRITERIOS = ['idade', 'previo', 'cirurgia', 'neoplasia', 'dorMembro', 'hemoptise', 'palpacao']
/** fc: 0 (<75), 1 (75–94 = 3), 2 (≥95 = 5); critérios presentes pelo id. */
const com = (fc: number, ...ids: string[]): Respostas => ({ fc, ...Object.fromEntries(CRITERIOS.map((k) => [k, ids.includes(k) ? 1 : 0])) })

test('genebra: FC 80 + idade > 65 + hemoptise = 3 + 1 + 2 = 6, intermediária', () => {
  const r = genebraRevisado.calcular(com(1, 'idade', 'hemoptise'))!
  assert.equal(r.valor, '6')
  assert.equal(r.estado, 1)
  assert.deepEqual(r.derivados[2], ['Pontos pela frequência cardíaca', '3'])
})
test('genebra: todos = 22, alta', () => {
  const r = genebraRevisado.calcular(com(2, ...CRITERIOS))!
  assert.equal(r.valor, '22')
  assert.equal(r.estado, 2)
})
test('genebra: cortes (3→baixa, 4→intermediária, 10→intermediária, 11→alta)', () => {
  assert.equal(genebraRevisado.calcular(com(0, 'previo'))!.estado, 0)
  assert.equal(genebraRevisado.calcular(com(0, 'palpacao'))!.estado, 1)
  const dez = genebraRevisado.calcular(com(2, 'previo', 'cirurgia'))!
  assert.equal(dez.valor, '10')
  assert.equal(dez.estado, 1)
  assert.match(dez.nota, /não alta/)
  const onze = genebraRevisado.calcular(com(2, 'previo', 'cirurgia', 'idade'))!
  assert.equal(onze.estado, 2)
  assert.match(onze.nota, /ALTA/)
})
test('genebra: incompleto devolve null', () => {
  const r = com(0)
  delete r.fc
  assert.equal(genebraRevisado.calcular(r), null)
})
test('genebra: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(genebraRevisado.ficha.publico, 'adulto')
  assert.ok(genebraRevisado.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(genebraRevisado.ficha), false)
})
