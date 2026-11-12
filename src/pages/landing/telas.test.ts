// Seção "Um plantão" da página de entrada (pedido 8, J4): as telas existem,
// são leves e não trazem marca de teste no texto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { ALTURA_TELA, LARGURA_TELA, TELAS } from './telas.ts'

const PUBLICO = join(import.meta.dirname, '..', '..', '..', 'public')

/** Largura e altura de um JPEG, lidas do primeiro marcador SOF. */
function tamanhoJpeg(dados: Buffer): { largura: number; altura: number } {
  let i = 2
  while (i < dados.length) {
    const marcador = dados[i + 1]
    const comprimento = dados.readUInt16BE(i + 2)
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      return { altura: dados.readUInt16BE(i + 5), largura: dados.readUInt16BE(i + 7) }
    }
    i += 2 + comprimento
  }
  throw new Error('JPEG sem marcador SOF')
}

test('são três telas, com id e rótulo únicos', () => {
  assert.equal(TELAS.length, 3)
  assert.equal(new Set(TELAS.map((t) => t.id)).size, 3)
  assert.equal(new Set(TELAS.map((t) => t.rotulo)).size, 3)
})

for (const tela of TELAS) {
  test(`${tela.id}: JPG de ${LARGURA_TELA} × ${ALTURA_TELA}, abaixo de 250 KB`, () => {
    const caminho = join(PUBLICO, tela.arquivo)
    assert.ok(statSync(caminho).size < 250 * 1024)
    const dados = readFileSync(caminho)
    assert.equal(dados.readUInt16BE(0), 0xffd8)
    assert.deepEqual(tamanhoJpeg(dados), { largura: LARGURA_TELA, altura: ALTURA_TELA })
  })

  test(`${tela.id}: texto alternativo descreve a tela, sem marca de teste`, () => {
    assert.ok(tela.alt.length > 40)
    for (const campo of [tela.titulo, tela.texto, tela.alt]) {
      assert.doesNotMatch(campo, /\b(teste|e2e|f5|homologa)/i)
    }
  })
}
