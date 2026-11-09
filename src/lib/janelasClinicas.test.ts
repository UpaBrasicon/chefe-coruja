import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 05 do kit de desempenho, decisão do RT em 09/11/2026 (A): nas telas
// clínicas, janela de tempo ou as mais recentes, com "ver mais". Estas leituras
// iam do primeiro ao último registro do paciente.

test('passagens de plantão: só as 20 mais recentes (o bloco usa a pendente e a última)', () => {
  const fonte = readFileSync('src/components/internacao/LeitoAberto.tsx', 'utf8')
  const trecho = fonte.slice(fonte.indexOf(".from('passagens_plantao')"), fonte.indexOf(".from('passagens_plantao')") + 300)
  assert.match(trecho, /\.limit\(20\)/)
})

test('trilha do episódio: eventos e transferências com limite e "ver mais"', () => {
  const fonte = readFileSync('src/components/internacao/caderno/Trilha.tsx', 'utf8')
  const eventos = fonte.slice(fonte.indexOf(".from('eventos_adt')"), fonte.indexOf(".from('eventos_adt')") + 400)
  const transf = fonte.slice(fonte.indexOf(".from('transferencias_paciente')"), fonte.indexOf(".from('transferencias_paciente')") + 400)
  assert.match(eventos, /\.limit\(limiteEventos \+ 1\)/)
  assert.match(transf, /\.limit\(limiteTransf \+ 1\)/)
  assert.match(fonte, /Ver eventos mais antigos/)
  assert.match(fonte, /Ver transferências mais antigas/)
})
