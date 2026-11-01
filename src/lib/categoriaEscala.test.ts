// node --experimental-strip-types --test src/lib/categoriaEscala.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { categoriaDaTela, daCategoria } from './categoriaEscala.ts'

const todos = ['plantonista', 'telemedicina', 'enfermeiro', 'tecnico_enfermagem', 'farmaceutico', 'recepcao'] as const

test('categoriaEscala: a categoria da tela é o papel ativo, não a lista de papéis', () => {
  // achado 3: "sua categoria" dizia todos os papéis do usuário
  assert.equal(categoriaDaTela('enfermeiro', [...todos]), 'enfermeiro')
  assert.equal(categoriaDaTela('telemedicina', [...todos]), 'telemedicina')
})

test('categoriaEscala: gestor e admin não são categoria da escala', () => {
  assert.equal(categoriaDaTela('gestor', ['gestor', 'plantonista']), null)
  assert.equal(categoriaDaTela('admin', ['admin']), null)
  assert.equal(categoriaDaTela(null, []), null)
})

test('categoriaEscala: plantão da categoria ativa; sem categoria conta como plantonista', () => {
  assert.equal(daCategoria('enfermeiro', 'enfermeiro'), true)
  assert.equal(daCategoria('tecnico_enfermagem', 'enfermeiro'), false)
  assert.equal(daCategoria(null, 'plantonista'), true)
  assert.equal(daCategoria(null, 'enfermeiro'), false)
  // sem categoria na tela (gestor), tudo entra
  assert.equal(daCategoria('recepcao', null), true)
})
