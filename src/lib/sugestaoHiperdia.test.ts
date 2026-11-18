// Percurso da UBS, U12 (parte 2): sugestão de hiperdia vinda do retorno da UPA.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('U12: a tela do hiperdia mostra as sugestões do retorno da UPA, com incluir e não incluir', () => {
  const pagina = readFileSync('src/pages/hiperdia/Hiperdia.tsx', 'utf8')
  assert.match(pagina, /<SugestoesHiperdia unidadeId=\{unidadeId\} podeIncluir=\{podeIncluir\} \/>/)
  const quadro = readFileSync('src/components/hiperdia/SugestoesHiperdia.tsx', 'utf8')
  assert.match(quadro, /supabase\.rpc\('hiperdia_sugestoes'/)
  assert.match(quadro, /supabase\.rpc\('programa_incluir'/)
  assert.match(quadro, /supabase\.rpc\('hiperdia_dispensar_sugestao'/)
  assert.match(quadro, /disabled=\{motivo\.trim\(\)\.length < 5\}/, 'não incluir exige motivo, como o banco')
})
