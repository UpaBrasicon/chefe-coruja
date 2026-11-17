import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conferir, gerarDocumento, tabelasDasMigrations } from './inventario-lgpd-regras.mjs'

const op = (id, tabelas, extra = {}) => ({
  id,
  nome: `Operação ${id}`,
  papel: 'operador',
  finalidade: 'f',
  base_legal: ['art. 11, II, f'],
  titulares: ['pacientes'],
  dados: ['d'],
  sensivel: true,
  acesso: ['médico'],
  local: ['Supabase (São Paulo)'],
  prazo: { guarda: '20 anos', base: 'Lei 13.787/2018', descarte: 'rotina' },
  seguranca: [],
  tabelas,
  ...extra,
})
const inv = (operacoes, fora = []) => ({
  versao: 'x',
  aviso: 'a',
  papeis: { operador: 'o', controlador: 'c' },
  seguranca_comum: ['s'],
  operacoes,
  fora_das_migrations: { motivo: 'm', tabelas: fora },
})

test('migrations: create menos drop, esquema public por padrão, ordem dos arquivos', () => {
  const t = tabelasDasMigrations([
    { nome: '002.sql', conteudo: 'DROP TABLE IF EXISTS public.velha;\nCREATE TABLE private.segredo (id int);' },
    { nome: '001.sql', conteudo: 'create table if not exists velha (id int);\ncreate table public.pacientes (id int);\n-- create table public.comentada (id int);' },
  ])
  assert.deepEqual([...t].sort(), ['private.segredo', 'public.pacientes'])
})

test('migrations: rename de tabela troca o nome', () => {
  const t = tabelasDasMigrations([{ nome: '001.sql', conteudo: 'create table public.a (id int); alter table public.a rename to b;' }])
  assert.deepEqual([...t], ['public.b'])
})

test('tabela nova sem operação faz falhar', () => {
  const p = conferir(inv([op('x', ['public.a'])]), new Set(['public.a', 'public.nova']))
  assert.equal(p.length, 1)
  assert.match(p[0], /public\.nova não está em nenhuma operação/)
})

test('tabela em duas operações faz falhar', () => {
  const p = conferir(inv([op('x', ['public.a']), op('y', ['public.a'])]), new Set(['public.a']))
  assert.ok(p.some((x) => /duas operações/.test(x)))
})

test('tabela do inventário que sumiu das migrations faz falhar, exceto as declaradas fora', () => {
  assert.ok(conferir(inv([op('x', ['public.a', 'public.sumiu'])]), new Set(['public.a'])).some((x) => /não existe nas migrations/.test(x)))
  assert.deepEqual(conferir(inv([op('x', ['public.a', 'e2e.t'])], ['e2e.t']), new Set(['public.a'])), [])
})

test('campo obrigatório vazio e papel inválido fazem falhar', () => {
  const p = conferir(inv([op('x', ['public.a'], { finalidade: '', papel: 'dono' })]), new Set(['public.a']))
  assert.ok(p.some((x) => /falta o campo "finalidade"/.test(x)))
  assert.ok(p.some((x) => /papel "dono"/.test(x)))
})

test('documento traz resumo e cada operação, e é determinístico', () => {
  const i = inv([op('x', ['public.a', 'public.b'])])
  const d = gerarDocumento(i)
  assert.match(d, /1 operações cobrem 2 tabelas/)
  assert.match(d, /\| Operação x \| operador \| sim \| 20 anos \| 2 \|/)
  assert.match(d, /`public\.a`, `public\.b`/)
  assert.equal(d, gerarDocumento(i))
})
