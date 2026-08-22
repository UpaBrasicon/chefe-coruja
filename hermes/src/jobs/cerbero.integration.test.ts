// Teste de integração do Cérbero — patrulhas A (dados) e C (hermes) contra o
// Supabase real. Verifica que rodam sem erro e retornam arrays (o conteúdo
// depende dos dados atuais; o importante é não quebrar).
import { test } from 'node:test'
import assert from 'node:assert/strict'

const SVC = process.env.SVC_KEY
const pular = !SVC

test('patrulhaDados — roda sem erro e retorna lista', { skip: pular }, async () => {
  const { patrulhaDados } = await import('./cerbero.ts')
  const achados = await patrulhaDados()
  assert.ok(Array.isArray(achados))
  for (const a of achados) {
    assert.ok(['dados'].includes(a.patrulha))
    assert.ok(['critico', 'atencao', 'informativo'].includes(a.severidade))
    assert.ok(typeof a.titulo === 'string' && a.titulo.length > 0)
  }
})

test('patrulhaHermes — roda sem erro e retorna lista', { skip: pular }, async () => {
  const { patrulhaHermes } = await import('./cerbero.ts')
  const achados = await patrulhaHermes()
  assert.ok(Array.isArray(achados))
  for (const a of achados) {
    assert.equal(a.patrulha, 'hermes')
  }
})

test('rodarPatrulhaDados — registra incidentes sem erro', { skip: pular }, async () => {
  const { rodarPatrulhaDados } = await import('./cerbero.ts')
  const n = await rodarPatrulhaDados()
  assert.equal(typeof n, 'number')
})
