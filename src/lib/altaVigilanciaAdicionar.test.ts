import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Ponto 1 das telas do farmacêutico (RT, 27/10/2026): "Alta vigilância não tem
// como adicionar medicações". O caminho existia só na busca da aba "Exige
// liberação"; agora há "Adicionar medicamento" no topo, em todas as abas.
const tela = readFileSync('src/pages/farmacia/AltaVigilancia.tsx', 'utf8')

test('o botão Adicionar medicamento fica fora das abas, para quem ajusta a lista', () => {
  assert.match(tela, /\{podeAjustar && \([\s\S]{0,300}Adicionar medicamento/)
})

test('adicionar marca na unidade, com motivo', () => {
  const ficha = tela.slice(tela.indexOf('function FichaAdicionar('))
  assert.match(ficha, /definir_alta_vigilancia', \{ p_unidade: unidadeId, p_medicamento: i\.id, p_exige: true, p_motivo: motivo\.trim\(\) \}/)
  assert.match(ficha, /motivo\.trim\(\)\.length < 10/)
})

test('o que não está no cadastro leva ao cadastro de medicamentos', () => {
  assert.match(tela, /<Link to="\/unidade-consumo"/)
})
