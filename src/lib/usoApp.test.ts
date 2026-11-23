// Fase 1, item 14: uso do app no próprio banco, sem pessoa (PH1 a PH3 = A do RT, 23/11/2026).
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const json = {
  desde: '2026-11-17',
  eventos: [
    { dia: '2026-11-23', unidade_id: 'u1', unidade: 'UPA Centro', papel: 'plantonista', evento: 'censo', detalhe: '', total: 4 },
    { dia: '2026-11-23', unidade_id: 'u1', unidade: 'UPA Centro', papel: 'plantonista', evento: 'ferramenta', detalhe: 'escores/heart', total: 3 },
    { dia: '2026-11-22', unidade_id: 'u1', unidade: 'UPA Centro', papel: 'plantonista', evento: 'ferramenta', detalhe: 'escores/heart', total: 2 },
    { dia: '2026-11-22', unidade_id: 'u1', unidade: 'UPA Centro', papel: 'plantonista', evento: 'ferramenta', detalhe: 'pediatria/bolus', total: 1 },
    { dia: '2026-11-22', unidade_id: 'u1', unidade: 'UPA Centro', papel: 'enfermeiro', evento: 'censo', detalhe: '', total: 2 },
    { dia: '2026-11-22', unidade_id: 'u2', unidade: 'UBS Norte', papel: 'plantonista', evento: 'central_aba', detalhe: 'escores', total: 1 },
    { dia: '2026-11-22', unidade_id: 'u2', unidade: 'UBS Norte', papel: 'plantonista', evento: 'outro', detalhe: '', total: 9 },
  ],
  entradas: [{ dia: '2026-11-23', entradas: 5, pessoas: 3 }, { dia: '2026-11-22', entradas: '2', pessoas: 2 }],
  ferramentas_desde_inicio: [{ chave: 'escores/heart', usos: 40 }],
}

test('lê o painel e soma por unidade e papel, ignorando evento fora da lista', async () => {
  const { lerPainel, porUnidadePapel, totalEntradas, totalEvento } = await import('../domain/usoApp.ts')
  const p = lerPainel(json)
  assert.equal(totalEntradas(p.entradas), 7)
  assert.equal(totalEvento(p.eventos, 'ferramenta'), 6)
  const linhas = porUnidadePapel(p.eventos)
  assert.deepEqual(linhas.map((l) => `${l.unidade}:${l.papel}:${l.total}`), ['UPA Centro:plantonista:10', 'UPA Centro:enfermeiro:2', 'UBS Norte:plantonista:1'])
  assert.equal(linhas[0].censo, 4)
  assert.equal(linhas[0].ferramenta, 6)
})

test('ranking das ferramentas e das abas soma os dias', async () => {
  const { lerPainel, ranking } = await import('../domain/usoApp.ts')
  const p = lerPainel(json)
  assert.deepEqual(ranking(p.eventos, 'ferramenta'), [{ detalhe: 'escores/heart', total: 5 }, { detalhe: 'pediatria/bolus', total: 1 }])
  assert.deepEqual(ranking(p.eventos, 'central_aba'), [{ detalhe: 'escores', total: 1 }])
})

test('formato estranho do banco não quebra a tela', async () => {
  const { lerPainel } = await import('../domain/usoApp.ts')
  assert.deepEqual(lerPainel(null), { desde: '', eventos: [], entradas: [], ferramentas_desde_inicio: [] })
  assert.deepEqual(lerPainel({ eventos: 'x', entradas: [null, 3] }).entradas, [])
})

test('o detalhe aceito pela tela é o mesmo do banco (nada de texto livre)', async () => {
  const { DETALHE_USO } = await import('./usoApp.ts').catch(() => ({ DETALHE_USO: null }))
  const migration = readFileSync('supabase/migrations/20270415000038_uso_app_diario.sql', 'utf8')
  assert.ok(migration.includes("'^([a-z0-9-]{1,80}(/[a-z0-9-]{1,120})?)?$'"))
  const fonte = readFileSync('src/lib/usoApp.ts', 'utf8')
  assert.ok(fonte.includes('/^([a-z0-9-]{1,80}(\\/[a-z0-9-]{1,120})?)?$/'))
  if (DETALHE_USO) {
    assert.ok(DETALHE_USO.test('escores/heart') && DETALHE_USO.test('') && !DETALHE_USO.test('Maria da Silva'))
  }
})

test('os três pontos do item 14 chamam o registro', () => {
  assert.match(readFileSync('src/pages/plantonista/ToolRouter.tsx', 'utf8'), /useRegistrarUsoApp\('ferramenta', chave\)/)
  assert.match(readFileSync('src/pages/plantonista/SectionHome.tsx', 'utf8'), /useRegistrarUsoApp\('central_aba'/)
  assert.match(readFileSync('src/pages/InternacaoPainel.tsx', 'utf8'), /useRegistrarUsoApp\('censo'\)/)
})
