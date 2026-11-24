// Seção "Um plantão" da página de entrada (pedido 8, J4): as telas existem,
// são leves e não trazem marca de teste no texto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { ALTURA_TELA, LARGURA_TELA, TELAS } from './telas.ts'

const PUBLICO = join(import.meta.dirname, '..', '..', '..', 'public')

/** Largura e altura de um WebP (RIFF … WEBP), lidas do primeiro bloco. */
function tamanhoWebp(dados: Buffer): { largura: number; altura: number } {
  if (dados.toString('ascii', 0, 4) !== 'RIFF' || dados.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('não é WebP')
  }
  const bloco = dados.toString('ascii', 12, 16)
  if (bloco === 'VP8 ') {
    // com perda: assinatura 9d 01 2a e, em seguida, largura e altura de 14 bits
    return { largura: dados.readUInt16LE(26) & 0x3fff, altura: dados.readUInt16LE(28) & 0x3fff }
  }
  if (bloco === 'VP8X') {
    // estendido: tela de 24 bits, guardada como valor − 1
    return { largura: dados.readUIntLE(24, 3) + 1, altura: dados.readUIntLE(27, 3) + 1 }
  }
  throw new Error(`bloco WebP não esperado: ${bloco}`)
}

test('são três telas, com id e rótulo únicos', () => {
  assert.equal(TELAS.length, 3)
  assert.equal(new Set(TELAS.map((t) => t.id)).size, 3)
  assert.equal(new Set(TELAS.map((t) => t.rotulo)).size, 3)
})

for (const tela of TELAS) {
  test(`${tela.id}: WebP de ${LARGURA_TELA} × ${ALTURA_TELA}, abaixo de 100 KB`, () => {
    assert.match(tela.arquivo, /\.webp$/)
    const caminho = join(PUBLICO, tela.arquivo)
    assert.ok(statSync(caminho).size < 100 * 1024)
    assert.deepEqual(tamanhoWebp(readFileSync(caminho)), { largura: LARGURA_TELA, altura: ALTURA_TELA })
  })

  test(`${tela.id}: texto alternativo descreve a tela, sem marca de teste`, () => {
    assert.ok(tela.alt.length > 40)
    for (const campo of [tela.titulo, tela.texto, tela.alt]) {
      assert.doesNotMatch(campo, /\b(teste|e2e|f5|homologa)/i)
    }
  })
}
