import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Teste de fluxo UBS → UPA (25/11/2026), achado A-8: o Pronto-Socorro da
// enfermagem listava os triados pelos setores da escala da pessoa, sem a
// unidade ativa. Com escala em duas unidades, a tela de uma mostrava os
// pacientes da outra. A lista é sempre da unidade ativa.
test('Pronto-Socorro da enfermagem: os triados são da unidade ativa', () => {
  const tela = readFileSync('src/pages/enfermagem/ProntoSocorroEnfermagem.tsx', 'utf8').replace(/\r/g, '')
  const consulta = tela.slice(tela.indexOf("queryKey: ['enfermagem-ps-triados'"), tela.indexOf(".eq('etapa', 'atendimento')"))
  assert.match(consulta, /enabled: !!unidadeId && meusSetores\.length > 0/)
  assert.match(consulta, /\.eq\('unidade_id', unidadeId!\)\s+\.in\('setor_id', meusSetores\)/)
})
