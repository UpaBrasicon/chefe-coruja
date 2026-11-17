// LG6 (I3): a auditoria do WhatsApp guarda tamanho e sha256, nunca o texto.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { resumoDoTexto } from './pipeline.js'

test('resumoDoTexto: tamanho e sha256, sem nenhum trecho do texto', () => {
  const texto = 'paciente Maria com dor torácica desde ontem'
  const r = resumoDoTexto(texto)
  assert.match(r, /^43 caracteres, sha256 [0-9a-f]{16}$/)
  assert.doesNotMatch(r, /Maria|dor/)
  assert.equal(resumoDoTexto(texto), r, 'o mesmo texto dá o mesmo resumo')
})
