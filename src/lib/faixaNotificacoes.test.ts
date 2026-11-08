// node --experimental-strip-types --test src/lib/faixaNotificacoes.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { faixaDeNotificacoes, rotuloDasOutras } from './faixaNotificacoes.ts'

const n = (k: number) => ({ id: `n${k}`, created_at: `2026-11-08T10:${String(k).padStart(2, '0')}:00Z` })

test('com até 3 notificações, mostra todas, da mais nova para a mais antiga', () => {
  const f = faixaDeNotificacoes([n(1), n(2), n(3)])
  assert.deepEqual(f.visiveis.map((x) => x.id), ['n3', 'n2', 'n1'])
  assert.equal(f.outras, 0)
})

test('com 39 notificações, mostra as 3 mais novas e conta as outras 36', () => {
  const lista = Array.from({ length: 39 }, (_, k) => n(k))
  const f = faixaDeNotificacoes(lista)
  assert.deepEqual(f.visiveis.map((x) => x.id), ['n38', 'n37', 'n36'])
  assert.equal(f.outras, 36)
})

test('a ordem de chegada da lista não importa', () => {
  const f = faixaDeNotificacoes([n(5), n(1), n(9), n(3)])
  assert.deepEqual(f.visiveis.map((x) => x.id), ['n9', 'n5', 'n3'])
  assert.equal(f.outras, 1)
})

test('sem notificação, nada a mostrar', () => {
  assert.deepEqual(faixaDeNotificacoes([]), { visiveis: [], outras: 0 })
})

test('o rótulo das outras concorda com o número', () => {
  assert.equal(rotuloDasOutras(1), 'e mais 1 notificação')
  assert.equal(rotuloDasOutras(36), 'e mais 36 notificações')
})
