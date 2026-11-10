import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Em 09/11/2026, os acentos do formulário do site chegavam à Resend trocados
// por "�" (U+FFFD já no corpo do e-mail). A correção (PR #529) manda o JSON à
// Resend só em ASCII (\uXXXX) e com charset=utf-8. A função do código do
// segundo fator envia do mesmo jeito ("Seu código de acesso") e leva a mesma
// correção, por prevenção (decisão do RT em 09/11/2026).
const fonte = readFileSync('supabase/functions/enviar-codigo-2fa/index.ts', 'utf8')
const chamada = fonte.slice(fonte.indexOf("fetch('https://api.resend.com/emails'"), fonte.indexOf("fetch('https://api.resend.com/emails'") + 700)

test('o corpo enviado à Resend vai em JSON só ASCII', () => {
  assert.match(chamada, /body: jsonAscii\(\{/)
})

test('o cabeçalho do envio declara charset=utf-8', () => {
  assert.match(chamada, /'Content-Type': 'application\/json; charset=utf-8'/)
})

test('jsonAscii troca todo caractere fora do ASCII por \\uXXXX e volta igual', () => {
  const corpoFn = fonte.match(/function jsonAscii\(valor: unknown\): string \{([\s\S]*?)\n\}/)
  assert.ok(corpoFn, 'a função define jsonAscii')
  const jsonAscii = new Function('valor', corpoFn[1]) as (v: unknown) => string
  const original = { subject: 'Seu código de acesso — Chefe Coruja', html: 'expira em 10 minutos; ignore este email — sua conta segue protegida' }
  const s = jsonAscii(original)
  assert.ok(/^[\x00-\x7f]*$/.test(s), 'só ASCII')
  assert.deepEqual(JSON.parse(s), original)
})
