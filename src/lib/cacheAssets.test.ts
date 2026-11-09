import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 27 do kit de desempenho (docs/desempenho/AUDITORIA.md): os arquivos com
// hash no nome (/assets/…) saíam com cache de 4 h (o padrão da Cloudflare por
// cima do max-age=0 da Vercel). Como o nome muda a cada versão, podem ficar um
// ano no navegador. O HTML e o service worker continuam sem cache.
type Regra = { source: string; headers: { key: string; value: string }[] }
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: Regra[] }
const cache = (fonte: string) =>
  vercel.headers.find((h) => h.source === fonte)?.headers.find((x) => x.key.toLowerCase() === 'cache-control')?.value

test('arquivos com hash: um ano, imutáveis', () => {
  assert.equal(cache('/assets/(.*)'), 'public, max-age=31536000, immutable')
})

test('HTML e service worker continuam sem cache (versão nova chega na hora)', () => {
  assert.equal(cache('/index.html'), 'no-cache')
  assert.equal(cache('/sw.js'), 'no-cache')
})
