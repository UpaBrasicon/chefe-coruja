import assert from 'node:assert/strict'
import { test } from 'node:test'

import { listaRevisores, podeAprovarEmLote, textoRevisaoPendente } from './comiteClinico.ts'

test('K6: ficha com dose (pede farmacêutico) fica fora do lote', () => {
  assert.equal(podeAprovarEmLote(['medico']), true)
  assert.equal(podeAprovarEmLote(['medico', 'enfermeiro']), true)
  assert.equal(podeAprovarEmLote(['medico', 'farmaceutico']), false)
  assert.equal(podeAprovarEmLote(undefined), true)
})

test('lista dos revisores em português, na ordem do comitê', () => {
  assert.equal(listaRevisores(['farmaceutico', 'medico']), 'médico e farmacêutico')
  assert.equal(listaRevisores(['enfermeiro']), 'enfermeiro')
  assert.equal(listaRevisores(['enfermeiro', 'farmaceutico', 'medico']), 'médico, farmacêutico e enfermeiro')
})

test('aviso da revisão que falta', () => {
  assert.equal(textoRevisaoPendente([]), null)
  assert.equal(textoRevisaoPendente(null), null)
  assert.equal(textoRevisaoPendente(['medico']), null)
  assert.equal(textoRevisaoPendente(['farmaceutico']), 'Falta a revisão do farmacêutico do comitê clínico. Confira a dose com a fonte citada.')
  assert.match(textoRevisaoPendente(['farmaceutico', 'enfermeiro']) ?? '', /do farmacêutico e do enfermeiro/)
  assert.equal(textoRevisaoPendente(['enfermeiro']), 'Falta a revisão do enfermeiro do comitê clínico. Confira com a fonte citada.')
})
