import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Ponto 2 das telas do farmacêutico (RT, 27/10/2026): a diluição nova é da
// unidade, e o modelo da rede só o super admin muda (migration 20270109000001).
const tela = readFileSync('src/pages/farmacia/Diluicoes.tsx', 'utf8')

test('a Nova diluição manda a unidade ao banco', () => {
  assert.match(tela, /salvar_diluicao', \{\s*p_id: undefined as unknown as string, p_dados: \{[^}]*unidade_id: unidade/)
})

// pergunta do RT no teste de 27/10/2026: "vai diluir em que? qual quantidade?"
test('a Nova diluição já pede em que diluir e quanto, no mesmo passo', () => {
  const nova = tela.slice(tela.indexOf('function NovaDiluicao('), tela.indexOf('const CAMPOS:'))
  assert.match(nova, /<CamposDiluicao prefixo="nd"/)
  const campos = tela.slice(tela.indexOf('const CAMPOS:'), tela.indexOf('function paraDados'))
  assert.ok(campos.indexOf("'diluicao_solucao'") < campos.indexOf("'reconstituicao_diluente'"), 'diluente antes da reconstituição')
  assert.match(campos, /'diluicao_volume_min_ml'/)
  assert.match(campos, /'tempo_infusao_min'/)
})

test('a Nova diluição oferece as cinco vias que a tabela aceita', () => {
  assert.match(tela, /\['EV', 'IM', 'SC', 'IN', 'VO'\]/)
})

test('o modelo da rede não é editável pela farmácia', () => {
  assert.match(tela, /const editavel = \(d\.status === 'rascunho' \|\| d\.status === 'revisado'\) && !daRede/)
})
