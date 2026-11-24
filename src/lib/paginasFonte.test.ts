// node --experimental-strip-types --test src/lib/paginasFonte.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ehSoPagina, semPaginas } from './paginasFonte.ts'

test('parêntese só com páginas sai inteiro', () => {
  assert.equal(semPaginas('Indicações de internação (p. 302–303).'), 'Indicações de internação.')
  assert.equal(semPaginas('Dose do manual (p. 20, 34–35, 55–57) e depois'), 'Dose do manual e depois')
  assert.equal(semPaginas('Planos (pp. 12-14)'), 'Planos')
  assert.equal(semPaginas('Medicações (p. 32; p. 33)'), 'Medicações')
  assert.equal(semPaginas('Dose (p. 641 e 643)'), 'Dose')
})

test('página dentro de outra referência sai e a referência fica', () => {
  assert.equal(semPaginas('Escala clínica (Tabela 1, p. 329)'), 'Escala clínica (Tabela 1)')
  assert.equal(semPaginas('Medicações (Quadro 8, p. 32; p. 33)'), 'Medicações (Quadro 8)')
  assert.equal(semPaginas('Outras heparinas (cap. 25, p. 353; cap. 32, p. 443)'), 'Outras heparinas (cap. 25; cap. 32)')
  assert.equal(semPaginas('o manual corta em 65 kg, p. 218'), 'o manual corta em 65 kg')
})

test('texto sem página não muda', () => {
  for (const t of ['Peso 70 kg', 'pH 7,2 e pCO2 40', 'p. ex. dipirona', 'Tabela 2', '(cap. 25)']) assert.equal(semPaginas(t), t)
})

test('pedaço que é só a página', () => {
  assert.equal(semPaginas('p. 41'), '')
  assert.ok(ehSoPagina(' p. 1360–1361 '))
  assert.ok(!ehSoPagina('Tabela 1, p. 4'))
})
