// Pedido 22 do checklist de desempenho (F10, opção conservadora): a página
// pública `/` é desenhada no navegador e o HTML chegava sem `meta description`.
// O index.html leva um resumo curto, em português, que aparece na busca e na
// prévia de link.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const INDEX = join(import.meta.dirname, '..', '..', '..', 'index.html')

test('index.html tem uma meta description só, curta e em português', () => {
  const html = readFileSync(INDEX, 'utf8')
  const metas = [...html.matchAll(/<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/g)]
  assert.equal(metas.length, 1)
  const texto = metas[0][1]
  // os buscadores cortam por volta de 155 a 160 caracteres
  assert.ok(texto.length >= 50 && texto.length <= 160, `${texto.length} caracteres`)
  assert.match(texto, /Prontuário/)
  assert.match(texto, /UPA e UBS/)
})
