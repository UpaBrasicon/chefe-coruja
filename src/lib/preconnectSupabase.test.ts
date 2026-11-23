import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 33 da trilha Desempenho (BACKLOG, pedido de 23/11/2026): o navegador
// abre DNS, TCP e TLS com o Supabase enquanto o JavaScript ainda carrega, em vez
// de esperar a primeira chamada do app. Medido do PC do RT: abrir a conexão custa
// de 60 a 100 ms (às vezes mais) e a primeira chamada pagava isso inteiro.
const html = readFileSync('index.html', 'utf8')
const cabeca = html.slice(0, html.indexOf('</head>'))

test('index.html abre a conexão com o Supabase antes do JavaScript', () => {
  const link = cabeca.match(/<link[^>]*rel="preconnect"[^>]*>/g)?.find((l) => l.includes('VITE_SUPABASE_URL'))
  assert.ok(link, 'falta <link rel="preconnect" href="%VITE_SUPABASE_URL%" crossorigin> no <head>')
  assert.match(link, /href="%VITE_SUPABASE_URL%"/)
  // supabase-js chama sem cookie (modo CORS anônimo); sem crossorigin o
  // navegador abriria outra conexão, que o fetch não reaproveita.
  assert.match(link, /\scrossorigin(\s|>|\/|=")/)
  assert.doesNotMatch(link, /use-credentials/)
})

test('o endereço vem do ambiente: a homologação aponta para o próprio projeto', () => {
  assert.doesNotMatch(html, /[a-z]{20}\.supabase\.co/)
})
