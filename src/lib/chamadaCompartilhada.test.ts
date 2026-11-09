import { test } from 'node:test'
import assert from 'node:assert/strict'

import { criarCompartilhada, limparCompartilhadas, precisaCarregarPerfil } from './chamadaCompartilhada.ts'

// Item 03 do kit de desempenho (docs/desempenho/AUDITORIA.md): a casca repetia
// a mesma leitura em toda recarga (perfis 3×, meu_plantao_agora por cinco
// caminhos, contexto_sem_conexao 2×). Estes testes travam o comportamento do
// compartilhamento que corrige isso.

function contador<T>(valor: T) {
  let chamadas = 0
  return {
    buscar: async () => {
      chamadas++
      return valor
    },
    get chamadas() {
      return chamadas
    },
  }
}

test('duas leituras ao mesmo tempo viram uma chamada só', async () => {
  const c = contador({ data: 1, error: null })
  const r = criarCompartilhada(c.buscar, { validadeMs: 0 })
  const [a, b] = await Promise.all([r.ler(), r.ler()])
  assert.equal(c.chamadas, 1)
  assert.deepEqual(a, b)
})

test('dentro da validade devolve o último resultado sem chamar de novo', async () => {
  let agora = 1_000
  const c = contador({ data: 1, error: null })
  const r = criarCompartilhada(c.buscar, { validadeMs: 15_000, relogio: () => agora })
  await r.ler()
  agora += 14_999
  await r.ler()
  assert.equal(c.chamadas, 1)
})

test('passada a validade chama de novo', async () => {
  let agora = 1_000
  const c = contador({ data: 1, error: null })
  const r = criarCompartilhada(c.buscar, { validadeMs: 15_000, relogio: () => agora })
  await r.ler()
  agora += 15_000
  await r.ler()
  assert.equal(c.chamadas, 2)
})

test('resposta com erro não fica guardada', async () => {
  let chamadas = 0
  const r = criarCompartilhada(async () => {
    chamadas++
    return { data: null, error: { message: 'falhou' } }
  }, { validadeMs: 60_000 })
  await r.ler()
  await r.ler()
  assert.equal(chamadas, 2)
})

test('exceção não fica guardada e a próxima leitura tenta de novo', async () => {
  let chamadas = 0
  const r = criarCompartilhada(async () => {
    chamadas++
    if (chamadas === 1) throw new Error('rede')
    return { data: 2, error: null }
  }, { validadeMs: 60_000 })
  await assert.rejects(r.ler())
  assert.deepEqual(await r.ler(), { data: 2, error: null })
  assert.equal(chamadas, 2)
})

test('limparCompartilhadas esquece o guardado de todas (troca de pessoa no aparelho)', async () => {
  const a = contador({ data: 'a', error: null })
  const b = contador({ data: 'b', error: null })
  const ra = criarCompartilhada(a.buscar, { validadeMs: 60_000 })
  const rb = criarCompartilhada(b.buscar, { validadeMs: 60_000 })
  await ra.ler()
  await rb.ler()
  limparCompartilhadas()
  await ra.ler()
  await rb.ler()
  assert.equal(a.chamadas, 2)
  assert.equal(b.chamadas, 2)
})

test('leitura em curso antes de limpar não volta a ser guardada', async () => {
  let soltar: (v: { data: string; error: null }) => void = () => {}
  let chamadas = 0
  const r = criarCompartilhada(() => {
    chamadas++
    return new Promise<{ data: string; error: null }>((res) => { soltar = res })
  }, { validadeMs: 60_000 })
  const antiga = r.ler()
  limparCompartilhadas()
  soltar({ data: 'da pessoa anterior', error: null })
  await antiga
  const nova = r.ler()
  soltar({ data: 'da pessoa nova', error: null })
  assert.deepEqual(await nova, { data: 'da pessoa nova', error: null })
  assert.equal(chamadas, 2)
})

// Perfil: getSession e os eventos INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED
// chegam juntos na recarga e cada um lia o perfil de novo.
test('perfil: mesma pessoa já carregada ou em carga não lê de novo', () => {
  assert.equal(precisaCarregarPerfil('INITIAL_SESSION', 'u1', { carregado: 'u1', emCarga: null }), false)
  assert.equal(precisaCarregarPerfil('SIGNED_IN', 'u1', { carregado: null, emCarga: 'u1' }), false)
  assert.equal(precisaCarregarPerfil('TOKEN_REFRESHED', 'u1', { carregado: 'u1', emCarga: null }), false)
})

test('perfil: pessoa nova, primeira carga ou USER_UPDATED leem', () => {
  assert.equal(precisaCarregarPerfil('getSession', 'u1', { carregado: null, emCarga: null }), true)
  assert.equal(precisaCarregarPerfil('SIGNED_IN', 'u2', { carregado: 'u1', emCarga: null }), true)
  assert.equal(precisaCarregarPerfil('SIGNED_IN', 'u2', { carregado: null, emCarga: 'u1' }), true)
  assert.equal(precisaCarregarPerfil('USER_UPDATED', 'u1', { carregado: 'u1', emCarga: null }), true)
})
