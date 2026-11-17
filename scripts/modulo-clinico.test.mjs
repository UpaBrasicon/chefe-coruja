import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conferirMapa, gerarDocumentoMapa, sqlRevisoes } from './modulo-clinico-regras.mjs'

const grupo = (id, fichas, extra = {}) => ({ id, nome: `Grupo ${id}`, classe: 'dentro', motivo: 'm', revisoes: ['medico'], fichas, ...extra })
const funcao = (id, extra = {}) => ({ id, nome: `Função ${id}`, classe: 'zona-cinzenta', motivo: 'm', onde: ['src/a.ts'], ...extra })
const mapa = (grupos, funcoes = []) => ({
  versao: 'x',
  aviso: 'a',
  classes: { dentro: 'd', 'zona-cinzenta': 'z', fora: 'f' },
  grupos,
  funcoes,
})
const existe = () => true

test('ficha nova fora do mapa faz falhar', () => {
  const p = conferirMapa(mapa([grupo('g', ['heart'])]), new Set(['heart', 'nova']), existe)
  assert.equal(p.length, 1)
  assert.match(p[0], /ficha nova não está em nenhum grupo/)
})

test('ficha em dois grupos e ficha que sumiu fazem falhar', () => {
  const p = conferirMapa(mapa([grupo('a', ['heart', 'sumiu']), grupo('b', ['heart'])]), new Set(['heart']), existe)
  assert.ok(p.some((x) => /dois grupos/.test(x)))
  assert.ok(p.some((x) => /sumiu está no mapa, mas não existe/.test(x)))
})

test('classe inválida, campo vazio e arquivo inexistente em função fazem falhar', () => {
  const p = conferirMapa(
    mapa([grupo('a', ['heart'], { classe: 'talvez' })], [funcao('f', { motivo: '', onde: ['nao/existe.ts'] })]),
    new Set(['heart']),
    (c) => c !== 'nao/existe.ts',
  )
  assert.ok(p.some((x) => /classe "talvez"/.test(x)))
  assert.ok(p.some((x) => /falta o campo "motivo"/.test(x)))
  assert.ok(p.some((x) => /nao\/existe\.ts não existe/.test(x)))
})

test('mapa certo passa', () => {
  assert.deepEqual(conferirMapa(mapa([grupo('a', ['heart'])], [funcao('f')]), new Set(['heart']), existe), [])
})

test('documento conta por classe e é determinístico', () => {
  const m = mapa([grupo('a', ['heart', 'timi']), grupo('b', ['fugulin'], { classe: 'fora' })], [funcao('f')])
  const d = gerarDocumentoMapa(m)
  assert.match(d, /3 fichas: 2 dentro, 0 na zona cinzenta e 1 fora\. Mais 1 funções/)
  assert.match(d, /\| Grupo a \| dentro \(SaMD provável\) \| medico \| 2 \|/)
  assert.equal(d, gerarDocumentoMapa(m))
})

test('LG13: revisões do grupo precisam incluir o médico e só profissões conhecidas', () => {
  const p = conferirMapa(mapa([grupo('a', ['x'], { revisoes: ['farmaceutico'] }), grupo('b', ['y'], { revisoes: ['medico', 'dentista'] })]), new Set(['x', 'y']), existe)
  assert.equal(p.filter((x) => /"revisoes" precisa incluir/.test(x)).length, 2)
})

test('LG13: SQL das revisões é idempotente e agrupa por conjunto', () => {
  const m = mapa([grupo('a', ['heart', "o'neil"]), grupo('b', ['bolus'], { revisoes: ['medico', 'farmaceutico'] })])
  const sql = sqlRevisoes(m)
  assert.match(sql, /SET revisoes_exigidas = ARRAY\['medico', 'farmaceutico'\]::text\[\]\n WHERE id = ANY \(ARRAY\['bolus'\]::text\[\]\)/)
  assert.match(sql, /ARRAY\['heart', 'o''neil'\]/)
  assert.match(sql, /IS DISTINCT FROM/)
  assert.doesNotMatch(sqlRevisoes(m, new Set(['bolus'])), /heart/)
})
