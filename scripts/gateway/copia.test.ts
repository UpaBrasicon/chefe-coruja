// A busca da Central (Edge Function clinical-search) usa uma cópia do
// desidentificador do gateway de IA do Hermes. As duas têm de ser iguais.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = join(import.meta.dirname, '..', '..')
const original = readFileSync(join(raiz, 'hermes', 'src', 'gateway', 'desidentificacao.ts'), 'utf8').replace(/\r\n/g, '\n')
const copia = readFileSync(join(raiz, 'supabase', 'functions', '_shared', 'desidentificacao.ts'), 'utf8').replace(/\r\n/g, '\n')

test('a cópia da Edge Function é o original com o cabeçalho de aviso', () => {
  const semCabecalho = copia.split('\n').slice(4).join('\n')
  assert.equal(semCabecalho, original)
})
