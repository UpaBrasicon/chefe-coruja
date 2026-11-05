import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Achado F5-T4 do portão da Fase 5: na recepção da UPA, "Chegou" sem escolher a
// ficha deixava o envio da UBS sem ligação, e depois não havia como ligar (o
// servidor só aceita marcar a chegada uma vez). A chegada passa a exigir a ficha.
test('a chegada vinda da UBS só se registra com a ficha escolhida', () => {
  const src = readFileSync('src/components/encaminhamento/VindoDaUbs.tsx', 'utf8')
  assert.doesNotMatch(src, /Ainda sem ficha/)
  assert.match(src, /<option value="" disabled>Escolha a ficha<\/option>/)
  assert.match(src, /disabled=\{!ficha \|\| marcar\.isPending\}/)
  assert.match(src, /p_episodio: ficha \}/)
  assert.match(src, /Nenhuma ficha aberta hoje\./)
})
