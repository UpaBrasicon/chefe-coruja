import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 12 do kit de desempenho, decisão do RT em 09/11/2026 (B): tempo-limite
// só na chamada à Resend, que manda o código do segundo fator por e-mail. Sem
// limite, uma Resend lenta deixava a pessoa esperando até a função cair.
const fonte = readFileSync('supabase/functions/enviar-codigo-2fa/index.ts', 'utf8')

test('a chamada à Resend tem tempo-limite', () => {
  const chamada = fonte.slice(fonte.indexOf("fetch('https://api.resend.com/emails'"))
  assert.ok(chamada.length > 0, 'a função chama a Resend')
  assert.match(chamada.slice(0, 600), /signal: AbortSignal\.timeout\(LIMITE_RESEND_MS\)/)
  assert.match(fonte, /const LIMITE_RESEND_MS = 10_000/)
})

test('estourar o tempo responde 504 com mensagem clara e relata o erro', () => {
  assert.match(fonte, /resend_demorou/)
  assert.match(fonte, /resposta\(504,/)
})
