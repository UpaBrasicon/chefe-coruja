import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Prontuário completo redesenhado (achado guardado, item 6; A em P1 a P7 e
// direção A do RT, 06/11/2026). A tela continua só de leitura, grava o acesso
// ao abrir e mantém alergias, regulações e o botão de impressão.
const tela = readFileSync('src/pages/prontuario/ProntuarioLeitura.tsx', 'utf8')
const linha = readFileSync('src/pages/prontuario/LinhaDoTempo.tsx', 'utf8')
const ambos = tela + linha

test('abrir a tela grava o acesso antes de ler a linha do tempo', () => {
  assert.match(tela, /await abrirProntuario\(pacienteId!\)/)
  // a leitura só começa depois que a abertura deu certo
  assert.match(tela, /enabled: abertura\.isSuccess/)
  assert.match(tela, /supabase\.rpc\('prontuario_leitura'/)
})

test('só leitura: nenhuma escrita e nenhuma outra RPC', () => {
  assert.doesNotMatch(ambos, /\.(insert|update|upsert|delete)\(/)
  assert.deepEqual([...ambos.matchAll(/\.rpc\('([a-z_]+)'/g)].map((m) => m[1]), ['prontuario_leitura'])
  assert.doesNotMatch(ambos, /useMutation|Salvar|Assinar|Registrar|Excluir|Editar/)
})

test('alergias (três estados) e regulações seguem na ficha', () => {
  assert.match(tela, /<AlergiasLeitura pacienteId=\{paciente\.id\} \/>/)
  assert.match(tela, /<HistoricoRegulacao pacienteId=\{paciente\.id\} \/>/)
  assert.match(tela, /estado === 'nega'/)
  assert.match(tela, /estado === 'nao_registrada'/)
})

test('o plantonista continua com o botão de imprimir', () => {
  assert.match(tela, /papelAtivo === 'plantonista'[\s\S]{0,200}\/impressao-prontuario\?paciente=\$\{paciente\.id\}/)
  assert.match(tela, /Imprimir prontuário/)
})

test('cor da enfermagem e sinais vitais crus', () => {
  assert.match(linha, /<PilulaRisco cor=\{comoCor\(g\.classificacao\.cor\)\} \/>/)
  // nada de faixa de referência nem marca do valor na tela
  assert.doesNotMatch(linha, /\.flag\b|ref_min|ref_max|\.critico\b/)
})

test('a rota do prontuário não mudou', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.match(app, /path="\/prontuarios\/:pacienteId"/)
})
