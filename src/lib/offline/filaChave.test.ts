// node --experimental-strip-types --test src/lib/offline/filaChave.test.ts
//
// Chave da fila sem conexão vinda do servidor (A em O1 a O5, RT em 05/11/2026;
// docs/porta/CHAVE-FILA-SERVIDOR-DIAGNOSTICO.md). A chave é da pessoa, vem do
// servidor depois do segundo fator e não fica no aparelho depois de sair.
import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const aba = new Map<string, string>()
Object.assign(globalThis, {
  sessionStorage: {
    getItem: (k: string) => aba.get(k) ?? null,
    setItem: (k: string, v: string) => { aba.set(k, v) },
    removeItem: (k: string) => { aba.delete(k) },
  },
})

const { chaveFilaDaAba, contar, definirChaveFila, enfileirar, listar, migrarFilaAntiga, remover, temChaveFila } = await import('./fila.ts')

const PERFIL = '10000000-0000-4000-8000-0000000000a1'
const b64 = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
const item = (id: string) => ({
  id, tipo: 'observacao' as const, hora: '2026-11-05T23:00:00.000Z', sem_conexao: true, ultimo_contato: null,
  aparelho_id: 'aparelho-teste', dados: { paciente: 'Paciente Teste Lima', texto: 'SpO2 91%' },
})

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const req = indexedDB.open('chefe-coruja-offline', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('chaves')
      req.result.createObjectStore('fila', { keyPath: 'id' }).createIndex('perfil', 'perfil')
    }
    req.onsuccess = () => ok(req.result)
    req.onerror = () => falha(req.error)
  })
}
const pedido = <T,>(r: IDBRequest<T>) => new Promise<T>((ok, falha) => { r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error) })

test('sem a chave do servidor, nada é gravado (e o chamador sabe por quê)', async () => {
  await definirChaveFila(null)
  assert.equal(temChaveFila(), false)
  await assert.rejects(enfileirar(PERFIL, [item('r0')]), /SEM_CHAVE_FILA/)
  assert.equal((await contar(PERFIL)).pendentes, 0)
})

test('com a chave da pessoa, grava cifrado e lê de volta; a cópia fica só na aba', async () => {
  const k = b64()
  await definirChaveFila(k)
  assert.equal(aba.get('cc-chave-fila'), k)
  await enfileirar(PERFIL, [item('r1')])
  const lidos = await listar(PERFIL)
  assert.equal(lidos.length, 1)
  assert.equal(lidos[0].dados.paciente, 'Paciente Teste Lima')

  // sair: a chave some da memória e da aba; a fila continua no aparelho, contada
  await definirChaveFila(null)
  assert.equal(aba.has('cc-chave-fila'), false)
  assert.deepEqual(await listar(PERFIL), [])
  assert.equal((await contar(PERFIL)).pendentes, 1, 'O4: os registros continuam no aparelho')

  // a mesma pessoa entra de novo: a mesma chave do servidor lê a fila
  await definirChaveFila(k)
  assert.equal((await listar(PERFIL)).length, 1)
  await remover(['r1'])
})

test('O2: recarga sem rede usa a cópia da aba', async () => {
  const k = b64()
  await definirChaveFila(k)
  await enfileirar(PERFIL, [item('r2')])
  // nova carga da página: memória vazia, aba com a cópia
  const copia = aba.get('cc-chave-fila')!
  await definirChaveFila(null)
  aba.set('cc-chave-fila', copia)
  assert.equal(await chaveFilaDaAba(), true)
  assert.equal((await listar(PERFIL)).length, 1)
  await remover(['r2'])
})

test('O5: depois da troca da chave, a fila antiga não se lê, mas não trava a lista', async () => {
  await definirChaveFila(b64())
  await enfileirar(PERFIL, [item('r3')])
  await definirChaveFila(b64())
  await enfileirar(PERFIL, [item('r4')])
  const lidos = await listar(PERFIL)
  assert.deepEqual(lidos.map((i) => i.id), ['r4'])
  assert.equal((await contar(PERFIL)).pendentes, 2)
  await remover(['r3', 'r4'])
})

test('O3: a fila gravada com a chave antiga do aparelho passa para a chave do servidor e a antiga é apagada', async () => {
  const db = await abrir()
  const antiga = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await pedido(db.transaction('chaves', 'readwrite').objectStore('chaves').put(antiga, PERFIL))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cifra = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, antiga, new TextEncoder().encode(JSON.stringify(item('r5'))))
  await pedido(db.transaction('fila', 'readwrite').objectStore('fila').put({ id: 'r5', perfil: PERFIL, iv, cifra }))

  await definirChaveFila(b64())
  assert.equal(await migrarFilaAntiga(PERFIL), 1)
  assert.equal(await pedido(db.transaction('chaves').objectStore('chaves').get(PERFIL)), undefined, 'chave antiga apagada')
  const lidos = await listar(PERFIL)
  assert.deepEqual(lidos.map((i) => i.id), ['r5'])
  assert.equal(await migrarFilaAntiga(PERFIL), 0, 'migrar de novo não faz nada')
})

test('a casca pede a chave depois do segundo fator e o sair apaga', () => {
  const casca = readFileSync('src/components/AppShell.tsx', 'utf8')
  assert.match(casca, /useChaveFila\(/)
  const auth = readFileSync('src/contexts/AuthContext.tsx', 'utf8')
  assert.ok((auth.match(/definirChaveFila\(null\)/g) ?? []).length >= 3, 'encerrarLocal, sem sessão e signOut')
  const gancho = readFileSync('src/hooks/useChaveFila.ts', 'utf8')
  assert.match(gancho, /rpc\('chave_fila'\)/)
  assert.match(gancho, /migrarFilaAntiga\(/)
})
