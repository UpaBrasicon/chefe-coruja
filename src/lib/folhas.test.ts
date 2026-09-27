import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// A folha do servidor e a provisória do aparelho saem do mesmo modelo.
test('a cópia da edge function é igual a src/lib/folhas.ts', () => {
  const origem = readFileSync('src/lib/folhas.ts', 'utf8')
  const copia = readFileSync('supabase/functions/_shared/folhas.ts', 'utf8')
  assert.equal(copia.replace(/^\/\/ GERADO[^\n]*\n/, ''), origem, 'rode: npm run folhas:copiar')
})
