// LG12, V2: e-mail ao RT no relato grave.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { assuntoAviso, jsonAscii, textoAviso, type DadosAviso } from './regras.ts'

const d: DadosAviso = {
  numero: 7, ferramenta_id: 'sepse-adulto', versao: '2026-11-17.1', desfecho: 'obito', unidade: 'UPA Centro',
  relatado_em: '2026-11-18T15:00:00Z', prazo_em: '2026-11-21T15:00:00Z', destinatarios: ['rt@exemplo.com'],
}

test('assunto diz o número e o desfecho', () => {
  assert.equal(assuntoAviso(d), 'Tecnovigilância: relato grave nº 7 (óbito)')
})

test('texto traz ferramenta, unidade e prazo em Brasília, sem descrição livre', () => {
  const t = textoAviso(d, 'https://www.chefecoruja.com.br')
  assert.match(t, /Ferramenta: sepse-adulto, versão 2026-11-17\.1/)
  assert.match(t, /Unidade: UPA Centro/)
  assert.match(t, /Recebido em: 18\/11\/2026,? 12:00/)
  assert.match(t, /Prazo \(RDC 67\/2009, art\. 8º\): 21\/11\/2026,? 12:00/)
  assert.match(t, /https:\/\/www\.chefecoruja\.com\.br\/revisao-clinica/)
  assert.doesNotMatch(t, /descri/i)
})

test('JSON vai só com ASCII', () => {
  assert.equal(jsonAscii({ a: 'ó' }), '{"a":"\\u00f3"}')
})
