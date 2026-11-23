// Contraste da plataforma, CT3 = A (RT, 23/11/2026): menu lateral aberto por
// padrão no computador, com o nome de cada item; recolher fica guardado.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('CT3: sem armazenamento, o menu abre (não recolhido)', async () => {
  const { lerLateralRecolhida, guardarLateralRecolhida } = await import('./lateral.ts')
  assert.equal(lerLateralRecolhida(), false)
  assert.doesNotThrow(() => guardarLateralRecolhida(true))
})

test('CT3: guarda e lê a escolha', async () => {
  const mem = new Map<string, string>()
  ;(globalThis as unknown as { window: unknown }).window = { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } }
  const { lerLateralRecolhida, guardarLateralRecolhida } = await import('./lateral.ts')
  guardarLateralRecolhida(true)
  assert.equal(lerLateralRecolhida(), true)
  guardarLateralRecolhida(false)
  assert.equal(lerLateralRecolhida(), false)
  delete (globalThis as unknown as { window?: unknown }).window
})

test('CT3: a lateral só recolhe quando a pessoa escolhe', () => {
  const c = readFileSync('src/components/casca/Lateral.tsx', 'utf8')
  assert.match(c, /useState\(lerLateralRecolhida\)/)
  assert.match(c, /recolhida && 'cc-recolhe'/)
  assert.doesNotMatch(c, /className="cc-side cc-recolhe /)
  assert.match(c, /'Recolher o menu'/)
})
