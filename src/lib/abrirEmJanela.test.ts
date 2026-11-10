// node --experimental-strip-types --test src/lib/abrirEmJanela.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { abrirEmJanela } from './abrirEmJanela.ts'

type Falsa = { opener: unknown; location: { href: string }; fechada: boolean; close: () => void }

function simular() {
  const abertas: { args: unknown[]; janela: Falsa }[] = []
  const g = globalThis as unknown as { window: { open: (...a: unknown[]) => Falsa | null } }
  g.window = {
    open: (...args: unknown[]) => {
      const janela: Falsa = { opener: 'pai', location: { href: '' }, fechada: false, close() { this.fechada = true } }
      abertas.push({ args, janela })
      return janela
    },
  }
  return abertas
}

test('a aba abre antes do await e recebe o endereço depois', async () => {
  const abertas = simular()
  let abertaAntes = false
  await abrirEmJanela(async () => {
    abertaAntes = abertas.length === 1
    return 'https://exemplo/assinado'
  })
  assert.equal(abertaAntes, true)
  assert.equal(abertas.length, 1)
  assert.equal(abertas[0].janela.location.href, 'https://exemplo/assinado')
  assert.equal(abertas[0].janela.opener, null)
})

test('sem endereço (null), a aba vazia fecha', async () => {
  const abertas = simular()
  await abrirEmJanela(async () => null)
  assert.equal(abertas[0].janela.fechada, true)
})

test('erro fecha a aba e chega a quem chamou', async () => {
  const abertas = simular()
  await assert.rejects(abrirEmJanela(async () => { throw new Error('Acesso negado') }), /Acesso negado/)
  assert.equal(abertas[0].janela.fechada, true)
})
