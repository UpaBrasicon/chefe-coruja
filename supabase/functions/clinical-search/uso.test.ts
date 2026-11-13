// Trilha Hermes / Evidências, E6: a linha de uso sai do stream e vira registro.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { lerUso, semLinhaDeUso, type Uso } from './uso.ts'

test('linha de uso válida vira os números da tabela', () => {
  assert.deepEqual(lerUso('{"type":"uso","modelo":"deepseek-flash","entrada_cache":10,"entrada":200,"saida":50}'),
    { modelo: 'deepseek-flash', tokens_entrada_cache: 10, tokens_entrada: 200, tokens_saida: 50 })
})

test('outras linhas e uso malformado não contam', () => {
  assert.equal(lerUso('{"type":"delta","text":"o uso de corticoide"}'), null)
  assert.equal(lerUso('{"type":"uso","modelo":"x","entrada_cache":-1,"entrada":2,"saida":3}'), null)
  assert.equal(lerUso('{"type":"uso","entrada_cache":1,"entrada":2,"saida":3}'), null)
  assert.equal(lerUso('não é json "uso"'), null)
})

test('o stream perde só a linha do uso, mesmo cortada entre pedaços', async () => {
  const gravados: Uso[] = []
  const t = semLinhaDeUso(async (u) => { gravados.push(u) })
  const linhas = '{"type":"meta"}\n{"type":"delta","text":"a"}\n{"type":"done"}\n{"type":"uso","modelo":"m","entrada_cache":1,"entrada":2,"saida":3}\n'
  const enc = new TextEncoder()
  const origem = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(linhas.slice(0, 40)))
      c.enqueue(enc.encode(linhas.slice(40, 75)))
      c.enqueue(enc.encode(linhas.slice(75)))
      c.close()
    },
  })
  const saida = await new Response(origem.pipeThrough(t)).text()
  assert.equal(saida, '{"type":"meta"}\n{"type":"delta","text":"a"}\n{"type":"done"}\n')
  assert.deepEqual(gravados, [{ modelo: 'm', tokens_entrada_cache: 1, tokens_entrada: 2, tokens_saida: 3 }])
})
