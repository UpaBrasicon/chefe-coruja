// Percurso da UBS, U15, vacina, PR 5: a vacina nos indicadores C2, C3, C6 e C7.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HOJE = '2026-11-19'

test('U15 PR 5: C2 (E) conta com o esquema completo', async () => {
  const { estadoDoItem, frasesDa, ITENS, FORA_DO_APP } = await import('../domain/puericultura.ts')
  assert.ok(ITENS.some((i) => i.item === 'vacinas' && i.letra === 'E' && i.pontos === 20))
  assert.ok(!FORA_DO_APP.some((i) => i.letra === 'E'))
  const base = { primeira_consulta: null, consultas: 0, datas_consultas: [], peso_altura: 0, datas_peso_altura: [], proxima_consulta: null, data_nascimento: '2026-01-10' }
  assert.equal(estadoDoItem({ ...base, vacinas_faltam: [] }, 'vacinas', HOJE), 'feito')
  assert.equal(estadoDoItem({ ...base, vacinas_faltam: ['VIP'] }, 'vacinas', HOJE), 'no_prazo')
  assert.equal(estadoDoItem({ ...base, data_nascimento: '2024-11-01', vacinas_faltam: ['VIP'] }, 'vacinas', HOJE), 'perdido')
  assert.ok(frasesDa({ ...base, vacinas_faltam: ['VIP', 'pneumocócica'] }, HOJE).aFazer.includes('vacinas: falta VIP, pneumocócica'))
})

test('U15 PR 5: C3 (F) dTpa a partir da 20ª semana', async () => {
  const { estadoDoItem, ITENS, FORA_DO_APP, JANELA, frasesDa } = await import('../domain/preNatal.ts')
  assert.equal(JANELA.dtpaDesde, 140)
  assert.ok(ITENS.some((i) => i.item === 'dtpa' && i.letra === 'F' && i.pontos === 9))
  assert.ok(!FORA_DO_APP.some((i) => i.letra === 'F'))
  const g = { id: 'g', origem: 'manual' as const, entrada_em: HOJE, dpp: null, fim_gestacao: null, puerperio_ate: null,
    desfecho: null, desfecho_em: null, proxima_consulta: null }
  assert.equal(estadoDoItem({ ...g, dum: '2026-08-01' }, 'dtpa', HOJE), 'ainda_nao') // 110 dias
  assert.equal(estadoDoItem({ ...g, dum: '2026-06-01' }, 'dtpa', HOJE), 'no_prazo') // 171 dias
  assert.equal(estadoDoItem({ ...g, dum: '2026-06-01', dtpa: '2026-11-01' }, 'dtpa', HOJE), 'feito')
  assert.equal(estadoDoItem({ ...g, dum: '2025-11-01' }, 'dtpa', HOJE), 'perdido') // gestação acabou
  assert.ok(frasesDa({ ...g, dum: '2025-11-01' }, HOJE).perdido.includes('sem dTpa a partir de 20 semanas'))
})

test('U15 PR 5: C6 e C7 com a vacina no teto do app', async () => {
  const { TETO_APP, c7Ministerio } = await import('../domain/indicadoresAps.ts')
  assert.deepEqual(TETO_APP, { C6: 75, C7: 100 })
  // tudo feito: 20 + 30 + 30 + 20 = 100
  const f = { faixa: 1, feito: 1 }
  assert.equal(c7Ministerio({ colo: f, ssr: f, mama: f, hpv: f }), 100)
})
