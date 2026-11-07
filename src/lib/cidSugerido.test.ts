import { test } from 'node:test'
import assert from 'node:assert/strict'

import { codigoDoCampo, lerCidsSugeridos, rotuloMotivo, sugestoesVisiveis, textoParaSugestao } from './cidSugerido.ts'

// CID de referência a partir da Avaliação (decisão do RT: A em C1 a C7,
// docs/porta/CID-SUGERIDO-AVALIACAO-DIAGNOSTICO.md). A regra fica no banco
// (cid_sugerir_do_texto); aqui só o que a tela decide.

test('texto curto ou vazio não consulta o servidor', () => {
  assert.equal(textoParaSugestao(''), '')
  assert.equal(textoParaSugestao('  '), '')
  assert.equal(textoParaSugestao('IA'), '')
  assert.equal(textoParaSugestao('...'), '')
  assert.equal(textoParaSugestao('PAC'), 'PAC')
})

test('o texto sai aparado, com espaços simples e no máximo 500 caracteres', () => {
  assert.equal(textoParaSugestao('  IAM  +   DPOC\n exacerbada '), 'IAM + DPOC exacerbada')
  assert.equal(textoParaSugestao('a'.repeat(800)).length, 500)
})

test('a resposta do servidor é lida com cuidado: só itens com código e descrição', () => {
  assert.deepEqual(lerCidsSugeridos(null), [])
  assert.deepEqual(lerCidsSugeridos({ codigo: 'J18.9' }), [])
  assert.deepEqual(lerCidsSugeridos([
    { codigo: 'J18.9', descricao: 'Pneumonia não especificada', motivo: 'sigla PAC' },
    { codigo: '', descricao: 'sem código' },
    { codigo: 'I21.9' },
    'J44.1',
    { codigo: 'R50.9', descricao: 'Febre não especificada' },
  ]), [
    { codigo: 'J18.9', descricao: 'Pneumonia não especificada', motivo: 'sigla PAC' },
    { codigo: 'R50.9', descricao: 'Febre não especificada', motivo: 'texto' },
  ])
})

test('o código do campo vale tanto para "J18.9" quanto para "J18.9 — Pneumonia…"', () => {
  assert.equal(codigoDoCampo('j18.9'), 'J18.9')
  assert.equal(codigoDoCampo(' J18.9 — Pneumonia não especificada'), 'J18.9')
  assert.equal(codigoDoCampo(''), '')
})

test('o CID que já está no campo não aparece de novo entre as referências', () => {
  const lista = [
    { codigo: 'J18.9', descricao: 'Pneumonia não especificada', motivo: 'sigla PAC' },
    { codigo: 'J12.9', descricao: 'Pneumonia viral não especificada', motivo: 'texto' },
  ]
  assert.deepEqual(sugestoesVisiveis(lista, 'J18.9').map((s) => s.codigo), ['J12.9'])
  assert.deepEqual(sugestoesVisiveis(lista, 'J18.9 — Pneumonia não especificada').map((s) => s.codigo), ['J12.9'])
  assert.deepEqual(sugestoesVisiveis(lista, '').map((s) => s.codigo), ['J18.9', 'J12.9'])
})

test('o motivo vira uma frase curta para a dica do botão', () => {
  assert.equal(rotuloMotivo('sigla PAC'), 'Pela sigla PAC')
  assert.equal(rotuloMotivo('termo pneumonia'), 'Pelo termo pneumonia')
  assert.equal(rotuloMotivo('texto'), 'Pela busca no texto da CID-10')
  assert.equal(rotuloMotivo('CIAP-2 R81 (tabela do e-SUS APS)'), 'Pela CIAP-2 R81 (tabela do e-SUS APS)')
})
