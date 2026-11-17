// LG10: testes da guarda de versão (G2) e do gate de aprovação (G1).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { avaliar, conferirAprovacao, ehTela, fichasUsadas, serializar, temDispensa } from './gate-fichas-regras.mjs'

const ficha = (id, versao, extra = {}) => ({ id, titulo: id, versao, publico: 'adulto', fontes: [{ citacao: 'Fonte' }], revisadoEm: '2026-11-17', ...extra })
const mapa = (...itens) => new Map(itens.map(([f, arq]) => [f.id, { ficha: f, arquivos: [arq] }]))

const cenario = (mudar = {}) => ({
  base: mapa([ficha('heart', 'v1'), 'src/clinico/escores/heart.ts'], [ficha('curb', 'v1'), 'src/clinico/escores/curb.ts']),
  cabeca: mapa([ficha('heart', 'v1'), 'src/clinico/escores/heart.ts'], [ficha('curb', 'v1'), 'src/clinico/escores/curb.ts']),
  toposBase: { heart: { resumo: 'a' } },
  toposCabeca: { heart: { resumo: 'a' } },
  guiasBase: {},
  guiasCabeca: {},
  mudados: [],
  fichasDaTela: new Map(),
  dispensa: false,
  ...mudar,
})

test('serializar: chaves em qualquer ordem dão o mesmo texto; função entra pelo código', () => {
  assert.equal(serializar({ a: 1, b: [2, { c: 3, d: 4 }] }), serializar({ b: [2, { d: 4, c: 3 }], a: 1 }))
  assert.notEqual(serializar({ f: (x) => x * 2 }), serializar({ f: (x) => x * 3 }))
})

test('dispensa só com a linha "Sem mudança clínica:" e um motivo', () => {
  assert.ok(temDispensa('Resumo\n\nSem mudança clínica: só abas e Copiar\n'))
  assert.ok(!temDispensa('Sem mudança clínica:'))
  assert.ok(!temDispensa('sem mudança de dose, ficha ou migration'))
  assert.ok(!temDispensa(undefined))
})

test('telas da Central contam; testes e outras pastas não', () => {
  assert.ok(ehTela('src/pages/plantonista/manual/Abstinencia.tsx'))
  assert.ok(ehTela('src/components/plantonista/ToolLayout.tsx'))
  assert.ok(!ehTela('src/pages/plantonista/manual/Abstinencia.test.tsx'))
  assert.ok(!ehTela('src/pages/gestor/Painel.tsx'))
})

test('nada mudou: liberado, sem versão nova', () => {
  const r = avaliar(cenario())
  assert.deepEqual(r, { erros: [], avisos: [], novas: [] })
})

test('topo mudou sem versão nova: erro, mesmo com a dispensa', () => {
  const r = avaliar(cenario({ toposCabeca: { heart: { resumo: 'b' } }, dispensa: true }))
  assert.equal(r.erros.length, 1)
  assert.match(r.erros[0], /^heart: mudou topo/)
})

test('guia e ficha mudaram sem versão nova: erro com as duas partes', () => {
  const cabeca = mapa([ficha('heart', 'v1', { fontes: [{ citacao: 'Outra' }] }), 'src/clinico/escores/heart.ts'], [ficha('curb', 'v1'), 'src/clinico/escores/curb.ts'])
  const r = avaliar(cenario({ cabeca, guiasCabeca: { heart: { passos: ['x'] } } }))
  assert.equal(r.erros.length, 1)
  assert.match(r.erros[0], /mudou ficha, guia/)
})

test('topo mudou com versão nova: liberado pela guarda e vai ao gate', () => {
  const cabeca = mapa([ficha('heart', 'v2'), 'src/clinico/escores/heart.ts'], [ficha('curb', 'v1'), 'src/clinico/escores/curb.ts'])
  const r = avaliar(cenario({ cabeca, toposCabeca: { heart: { resumo: 'b' } } }))
  assert.deepEqual(r.erros, [])
  assert.deepEqual(r.novas, [{ ferramenta_id: 'heart', versao: 'v2' }])
})

test('arquivo da ficha mudou sem versão nova: erro, sem dispensa', () => {
  const r = avaliar(cenario({ mudados: ['src/clinico/escores/heart.ts'], dispensa: true }))
  assert.equal(r.erros.length, 1)
  assert.match(r.erros[0], /heart\.ts mudou .*: heart\./)
})

test('tela ligada a ficha mudou: erro sem a dispensa, aviso com ela', () => {
  const p = { mudados: ['src/pages/plantonista/escores/Heart.tsx'], fichasDaTela: new Map([['src/pages/plantonista/escores/Heart.tsx', ['heart']]]) }
  const sem = avaliar(cenario(p))
  assert.equal(sem.erros.length, 1)
  assert.match(sem.erros[0], /Sem mudança clínica/)
  const com = avaliar(cenario({ ...p, dispensa: true }))
  assert.deepEqual(com.erros, [])
  assert.match(com.avisos[0], /com "Sem mudança clínica"/)
})

test('tela sem ficha ligada e helper do pacote: só aviso para conferir à mão', () => {
  const r = avaliar(cenario({ mudados: ['src/components/plantonista/ToolLayout.tsx', 'src/clinico/escore.ts'] }))
  assert.deepEqual(r.erros, [])
  assert.match(r.avisos[0], /ToolLayout\.tsx, src\/clinico\/escore\.ts/)
})

test('ficha nova vai ao gate', () => {
  const cabeca = mapa([ficha('heart', 'v1'), 'src/clinico/escores/heart.ts'], [ficha('curb', 'v1'), 'src/clinico/escores/curb.ts'], [ficha('nova', 'v1'), 'src/clinico/escores/nova.ts'])
  const r = avaliar(cenario({ cabeca, mudados: ['src/clinico/escores/nova.ts'] }))
  assert.deepEqual(r.erros, [])
  assert.deepEqual(r.novas, [{ ferramenta_id: 'nova', versao: 'v1' }])
})

test('gate: só aprovada passa; aguardando, não registrada e sem resposta bloqueiam', () => {
  const novas = [
    { ferramenta_id: 'a', versao: 'v2' },
    { ferramenta_id: 'b', versao: 'v2' },
    { ferramenta_id: 'c', versao: 'v1' },
    { ferramenta_id: 'd', versao: 'v1' },
  ]
  const erros = conferirAprovacao(novas, [
    { ferramenta_id: 'a', versao: 'v2', status: 'aprovada' },
    { ferramenta_id: 'b', versao: 'v2', status: 'aguardando_aprovacao' },
    { ferramenta_id: 'c', versao: 'v1', status: 'nao_registrada' },
  ])
  assert.equal(erros.length, 3)
  assert.match(erros[0], /^b v2: aguardando_aprovacao/)
  assert.match(erros[1], /^c v1: nao_registrada/)
  assert.match(erros[2], /^d v1: sem_resposta/)
})

test('fichasUsadas: ficha solta e escore com .ficha, importados de @/clinico', () => {
  const fonte = `import { fichaHeart, type Outro } from '@/clinico/escores/heart'\nimport { curb as c } from '@/clinico/escores/curb'\nimport { x } from '@/lib/y'`
  const modulos = {
    'escores/heart': { fichaHeart: ficha('heart', 'v1') },
    'escores/curb': { curb: { ficha: ficha('curb', 'v1'), calcular: () => 0 } },
  }
  assert.deepEqual(fichasUsadas(fonte, (m) => modulos[m]), ['curb', 'heart'])
})
