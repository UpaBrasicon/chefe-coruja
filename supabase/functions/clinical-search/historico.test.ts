// IA1 (RT, 24/11/2026): leitura do histórico da conversa e a linha de abertura do stream.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { comAbertura, lerHistorico, LINHA_SEGUIMENTO, MAX_RESPOSTA, semCitacoes } from './historico.ts'

test('sem histórico ou com formato errado: lista vazia', () => {
  assert.deepEqual(lerHistorico(undefined), [])
  assert.deepEqual(lerHistorico('texto'), [])
  assert.deepEqual(lerHistorico([null, 3, { resposta: 'x' }]), [])
})

test('fica só com as 2 últimas trocas', () => {
  const h = lerHistorico([
    { pergunta: 'primeira', resposta: 'a' },
    { pergunta: 'segunda', resposta: 'b' },
    { pergunta: 'terceira', resposta: 'c' },
  ])
  assert.deepEqual(h.map((t) => t.pergunta), ['segunda', 'terceira'])
})

test('a resposta perde as citações [n] e é cortada no teto', () => {
  const [t] = lerHistorico([{ pergunta: 'dose de amiodarona', resposta: 'Ataque de 150 mg [1] em 10 min [2, 3].' }])
  assert.equal(t.resposta, 'Ataque de 150 mg em 10 min.')
  const [longa] = lerHistorico([{ pergunta: 'x y', resposta: 'a'.repeat(5000) }])
  assert.equal(longa.resposta.length, MAX_RESPOSTA)
})

test('pergunta curta demais ou longa demais sai; resposta ausente fica vazia', () => {
  assert.deepEqual(lerHistorico([{ pergunta: 'a' }, { pergunta: 'b'.repeat(801) }]), [])
  assert.deepEqual(lerHistorico([{ pergunta: 'dose de dipirona' }]), [{ pergunta: 'dose de dipirona', resposta: '' }])
})

test('semCitacoes não mexe em colchete que não é citação', () => {
  assert.equal(semCitacoes('[PACIENTE_1] com febre [1]'), '[PACIENTE_1] com febre')
})

test('a linha de seguimento vem antes do stream da biblioteca', async () => {
  const enc = new TextEncoder()
  const origem = new ReadableStream<Uint8Array>({
    start(c) { c.enqueue(enc.encode('{"type":"meta"}\n')); c.close() },
  })
  const texto = await new Response(origem.pipeThrough(comAbertura(LINHA_SEGUIMENTO))).text()
  assert.equal(texto, '{"type":"seguimento","aceita":true}\n{"type":"meta"}\n')
})
