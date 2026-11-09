import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 05 do kit de desempenho, parte c (decisão do RT em 09/11/2026, A):
// pareceres e procedimentos do paciente chegavam inteiros, da vida toda.

test('pareceres: os abertos vêm todos; os encerrados em páginas com "Ver mais"', () => {
  const fonte = readFileSync('src/components/parecer/AbaParecer.tsx', 'utf8')
  // um parecer aberto antigo não pode sumir da tela (com o "Cancelar pedido")
  assert.match(fonte, /\.in\('status', \[\.\.\.ABERTOS\]\)/)
  assert.match(fonte, /\.not\('status', 'in', `\(\$\{ABERTOS\.join\(','\)\}\)`\)/)
  assert.match(fonte, /\.range\(0, limite - 1\)/)
  assert.match(fonte, /<VerMais\b/)
})

test('procedimentos: em páginas, pela função irmã, com "Ver mais"', () => {
  const fonte = readFileSync('src/components/paciente/ProcedimentosRealizados.tsx', 'utf8')
  assert.match(fonte, /rpc\('procedimentos_do_paciente_pagina', \{[^}]*p_limite: limite/)
  assert.match(fonte, /<VerMais\b/)
})
