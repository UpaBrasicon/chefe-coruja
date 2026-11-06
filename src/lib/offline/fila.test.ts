// node --experimental-strip-types --test src/lib/offline/fila.test.ts
// Fase 0, item 20: a fila do modo sem conexão não guarda registro clínico em
// claro e não perde registro quando a sessão acaba antes de sincronizar.
import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { definirChaveFila, enfileirar, listar, remover } from './fila.ts'

const PERFIL = '10000000-0000-4000-8000-000000000002'
// a chave da pessoa vem do servidor (chave_fila(); A em O1 a O5, RT em 05/11/2026)
const CHAVE_DA_PESSOA = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
await definirChaveFila(CHAVE_DA_PESSOA)
const item = {
  id: 'reg-1',
  tipo: 'observacao' as const,
  hora: '2026-10-07T21:00:00.000Z',
  sem_conexao: true,
  ultimo_contato: null,
  aparelho_id: 'aparelho-teste',
  dados: { paciente: 'José Demonstração da Silva', texto: 'Dispneia, SpO2 91%' },
}

function lerTudoDoDisco(): Promise<unknown[]> {
  return new Promise((ok, falha) => {
    const req = indexedDB.open('chefe-coruja-offline', 1)
    req.onsuccess = () => {
      const r = req.result.transaction('fila').objectStore('fila').getAll()
      r.onsuccess = () => ok(r.result)
      r.onerror = () => falha(r.error)
    }
    req.onerror = () => falha(req.error)
  })
}

test('fila: o que vai para o IndexedDB é cifra, não o registro em claro', async () => {
  await enfileirar(PERFIL, [item])
  const guardados = await lerTudoDoDisco()
  assert.equal(guardados.length, 1)
  const g = guardados[0] as Record<string, unknown>
  assert.deepEqual(Object.keys(g).sort(), ['cifra', 'id', 'iv', 'perfil'])
  const bytes = new Uint8Array(g.cifra as ArrayBuffer)
  const comoTexto = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  assert.ok(!comoTexto.includes('José'), 'nome do paciente legível no disco')
  assert.ok(!comoTexto.includes('Dispneia'), 'texto clínico legível no disco')
  assert.ok(!JSON.stringify(g).includes('Demonstração'))
})

test('fila: a chave não depende da sessão — o registro volta inteiro depois de sair e entrar', async () => {
  // sair apaga a chave da memória e da aba; entrar de novo traz a mesma chave da pessoa
  await definirChaveFila(null)
  await definirChaveFila(CHAVE_DA_PESSOA)
  const lidos = await listar(PERFIL)
  assert.equal(lidos.length, 1)
  assert.deepEqual(lidos[0].dados, item.dados)
})

test('fila: outra pessoa no mesmo aparelho não lista a fila alheia', async () => {
  assert.deepEqual(await listar('10000000-0000-4000-8000-000000000004'), [])
})

test('fila: só sai quando o servidor confirma', async () => {
  await remover(['reg-1'])
  assert.deepEqual(await listar(PERFIL), [])
})
