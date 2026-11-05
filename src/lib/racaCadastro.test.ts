import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { RACAS_COR, RACAS_COR_CADASTRO } from './cadastro.ts'

// Pergunta F5-T6 do portão da Fase 5 (RT, 05/11/2026: "tirar"): o BPA-I não
// aceita raça/cor "Sem informação", então o cadastro deixa de oferecer.
test('o cadastro não oferece raça/cor "Sem informação"', () => {
  assert.deepEqual(RACAS_COR_CADASTRO.map((r) => r.valor), ['branca', 'preta', 'parda', 'amarela', 'indigena'])
  const form = readFileSync('src/components/paciente/CamposCadastro.tsx', 'utf8')
  assert.match(form, /opcoes=\{RACAS_COR_CADASTRO\}/)
  assert.doesNotMatch(form, /opcoes=\{RACAS_COR\}/)
})

test('os cadastros antigos com "Sem informação" continuam com rótulo', () => {
  assert.equal(RACAS_COR.find((r) => r.valor === 'sem_informacao')?.rotulo, 'Sem informação')
})
