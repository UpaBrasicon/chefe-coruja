// Fase 1, item 15 (P1): a tela "Aguardando liberação" libera sozinha.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('Fase 1, item 15: liberado com vínculo ativo ou super admin', async () => {
  const { estaLiberado, INTERVALO_LIBERACAO_MS } = await import('../domain/liberacao.ts')
  assert.equal(estaLiberado(0, false), false)
  assert.equal(estaLiberado(1, false), true)
  assert.equal(estaLiberado(0, true), true)
  assert.equal(INTERVALO_LIBERACAO_MS, 30_000)
})

test('Fase 1, item 15: a tela confere sozinha e vai para o início quando libera', () => {
  const tela = readFileSync('src/pages/AguardandoLiberacao.tsx', 'utf8')
  assert.match(tela, /refetchInterval: INTERVALO_LIBERACAO_MS/)
  assert.match(tela, /refetchOnWindowFocus: true/)
  assert.match(tela, /navigate\('\/', \{ replace: true \}\)/)
  assert.match(tela, /invalidateQueries\(\{ queryKey: \['vinculos'\] \}\)/)
  assert.doesNotMatch(tela, /na próxima entrada/)
})
