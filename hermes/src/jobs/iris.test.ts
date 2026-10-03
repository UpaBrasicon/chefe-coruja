// Testes da Andorinha (Íris) — dispatch de notificações com banco fake.
// Cobre o fluxo de dispatchIrisParaGestores sem tocar a rede.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dispatchIris, dispatchIrisParaGestores } from './iris.js'

// ── Banco fake no formato de lib/db-job.ts ─────────────────────────────────

function clienteFake(opcoes: {
  vinculos?: { perfil_id: string; papel?: string }[]
  insertErro?: string | null
}) {
  const chamadas: { tabela: string; dado?: unknown }[] = []
  let ids = 0

  return {
    chamadas,
    // gestoresDaUnidade filtra papel gestor/admin no SQL — o fake replica.
    gestoresDaUnidade: async () => ({
      data: (opcoes.vinculos ?? [])
        .filter((v) => ['gestor', 'admin'].includes(v.papel ?? ''))
        .map(({ perfil_id }) => ({ perfil_id })),
      error: null,
    }),
    inserirNotificacao: async (dado: unknown) => {
      chamadas.push({ tabela: 'notificacoes_plantonista', dado })
      return {
        data: opcoes.insertErro ? null : { id: `id-${++ids}` },
        error: opcoes.insertErro ? { message: opcoes.insertErro } : null,
      }
    },
  }
}

// ── dispatchIris ─────────────────────────────────────────────────────────────

test('dispatchIris — insere com tipo/mensagem e retorna id', async () => {
  const fake = clienteFake({})
  const r = await dispatchIris(
    { perfilId: 'p1', unidadeId: 'u1', tipo: 'alerta', mensagem: 'olá mundo' },
    fake as never
  )
  assert.equal(r.ok, true)
  assert.ok(r.id)
  assert.equal(fake.chamadas.length, 1)
  assert.equal(fake.chamadas[0].tabela, 'notificacoes_plantonista')
  const inserido = fake.chamadas[0].dado as Record<string, unknown>
  assert.equal(inserido.perfil_id, 'p1')
  assert.equal(inserido.tipo, 'alerta')
})

test('dispatchIris — trunca mensagem em 500 chars (anti-bomba de payload)', async () => {
  const fake = clienteFake({})
  const longa = 'x'.repeat(700)
  await dispatchIris({ perfilId: 'p1', unidadeId: 'u1', tipo: 't', mensagem: longa }, fake as never)
  const inserido = fake.chamadas[0].dado as Record<string, unknown>
  assert.equal((inserido.mensagem as string).length, 500)
})

test('dispatchIris — erro do banco retorna { ok: false, erro }', async () => {
  const fake = clienteFake({ insertErro: 'connection refused' })
  const r = await dispatchIris({ perfilId: 'p1', unidadeId: 'u1', tipo: 't', mensagem: 'm' }, fake as never)
  assert.equal(r.ok, false)
  assert.equal(r.erro, 'connection refused')
})

// ── dispatchIrisParaGestores ─────────────────────────────────────────────────

test('dispatchIrisParaGestores — notifica cada gestor/admin da unidade', async () => {
  const fake = clienteFake({
    vinculos: [
      { perfil_id: 'gestor-1', papel: 'gestor' },
      { perfil_id: 'admin-1', papel: 'admin' },
      { perfil_id: 'plantonista-1', papel: 'plantonista' }, // não deve ser notificado (filtro no SQL)
    ],
  })
  const n = await dispatchIrisParaGestores('u1', 'sentinela', 'alerta de escala', fake as never)
  assert.equal(n, 2)
  assert.equal(fake.chamadas.length, 2)
  const perfis = fake.chamadas.map((c) => (c.dado as Record<string, unknown>).perfil_id)
  assert.deepEqual(perfis, ['gestor-1', 'admin-1'])
})

test('dispatchIrisParaGestores — sem gestores retorna 0 sem inserir', async () => {
  const fake = clienteFake({ vinculos: [] })
  const n = await dispatchIrisParaGestores('u1', 'sentinela', 'msg', fake as never)
  assert.equal(n, 0)
  assert.equal(fake.chamadas.length, 0)
})
