// node --experimental-strip-types --test src/lib/rotaEscala.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { destinoEscala } from './rotaEscala.ts'

test('rotaEscala: gestor e admin ficam na escala do gestor', () => {
  assert.equal(destinoEscala('gestor'), null)
  assert.equal(destinoEscala('admin'), null)
})

test('rotaEscala: plantonista vai para a Agenda, mesmo tendo o papel de gestor na unidade', () => {
  // o destino depende só do papel ativo, não da lista de papéis
  assert.equal(destinoEscala('plantonista'), '/agenda?aba=escala')
})

test('rotaEscala: os demais papéis vão para /minha-escala, como no menu deles', () => {
  for (const papel of ['enfermeiro', 'tecnico_enfermagem', 'farmaceutico', 'recepcao', 'telemedicina'] as const) {
    assert.equal(destinoEscala(papel), '/minha-escala', papel)
  }
  assert.equal(destinoEscala(null), '/minha-escala')
})
