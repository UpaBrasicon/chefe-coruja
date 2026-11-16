// node --test scripts/e2e/trava.test.mjs
// S10, H4: todo SQL do e2e grava (contas, escala, passos, e2e.vars) e começa
// pela trava "só banco com a marca ambiente_teste" (homologação ou banco local). Este teste impede SQL novo sem ela.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const PASTA = import.meta.dirname
const arquivos = readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort()

/** Primeiro comando do arquivo, sem comentários, linhas vazias e \set do psql. */
function primeiroComando(sql) {
  for (const linha of sql.replace(/\r\n/g, '\n').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('--') || /^\\set\b/.test(t)) continue
    return t
  }
  return ''
}

test('há SQL do e2e para conferir', () => {
  assert.ok(arquivos.length > 50, `só ${arquivos.length} arquivo(s)`)
})

for (const f of arquivos) {
  test(`${f}: começa pela trava da homologação/banco local`, () => {
    const sql = readFileSync(join(PASTA, f), 'utf8')
    assert.equal(primeiroComando(sql), 'DO $trava$', 'o primeiro comando tem de ser a trava (DO $trava$ … $trava$)')
    const trava = sql.slice(sql.indexOf('DO $trava$'), sql.indexOf('$trava$;') + 8)
    assert.match(trava, /chave = 'ambiente_teste'/)
    assert.doesNotMatch(trava, /31000000-0000-4000-8000-000000000001/, 'a UPA Homologação existe também na produção')
    assert.match(trava, /RAISE EXCEPTION 'Este banco não é de teste/)
  })
}
