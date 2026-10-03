// Testes do montador de SQL do shim `.rpc()` (lib/pg.ts) — sem banco.
// O valor do chamador nunca entra no texto: só nomes/tipos vindos do catálogo,
// já validados; o resto vai no $1 (jsonb).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarChamada } from './pg.js'

const base = { retset: false, tipoKind: 'b', tipoNome: 'uuid', obrigatorias: 0, temSaidas: false }

test('RETURNS TABLE → objeto por linha (subconsulta _f.*)', () => {
  const s = montarChamada('hermes_unidade_setores', {
    ...base, retset: true, tipoKind: 'p', tipoNome: 'record', temSaidas: true,
    entradas: [{ nome: 'p_perfil', tipo: 'uuid' }, { nome: 'p_unidade', tipo: 'uuid' }],
  }, ['p_perfil', 'p_unidade'])
  assert.match(s, /json_agg\(_r\).*select _f\.\* from pg_catalog\.jsonb_to_record\(\$1::jsonb\) as _a\("p_perfil" uuid, "p_unidade" uuid\), public\."hermes_unidade_setores"\("p_perfil" => _a\."p_perfil", "p_unidade" => _a\."p_unidade"\) as _f/)
})

test('escalar → to_json; void → sem dado; só argumentos passados entram', () => {
  const e = montarChamada('f', { ...base, entradas: [{ nome: 'p_a', tipo: 'text' }, { nome: 'p_b', tipo: 'integer' }] }, ['p_a'])
  assert.equal(e, 'select pg_catalog.to_json(public."f"("p_a" => _a."p_a")) as r from pg_catalog.jsonb_to_record($1::jsonb) as _a("p_a" text)')
  const v = montarChamada('g', { ...base, tipoKind: 'p', tipoNome: 'void', entradas: [] }, [])
  assert.equal(v, 'select public."g"() is null as r')
})

test('setof escalar → array de valores', () => {
  const s = montarChamada('h', { ...base, retset: true, tipoNome: 'text', entradas: [] }, [])
  assert.equal(s, `select coalesce(pg_catalog.json_agg(_f), '[]'::json) as r from public."h"() as _f`)
})

test('tipo ou nome fora do padrão no catálogo → recusa montar', () => {
  assert.throws(() => montarChamada('f', { ...base, entradas: [{ nome: 'p_a', tipo: "text); drop table x; --" }] }, ['p_a']))
  assert.throws(() => montarChamada('f', { ...base, entradas: [{ nome: 'P"a', tipo: 'text' }] }, ['P"a']))
})
